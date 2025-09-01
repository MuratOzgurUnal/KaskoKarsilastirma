// api/analyze.js - NİHAİ VE ÇALIŞAN KOD
const { formidable } = require('formidable');
const fs = require('fs').promises;
const pdf = require('pdf-parse');
const { VertexAI } = require('@google-cloud/vertexai');

require('dotenv').config();

const AI_MODEL_NAME = "gemini-2.5-flash"; 
const GCP_LOCATION = "us-central1"; 
const MAX_TEXT_LENGTH = 15000;

let vertex_ai;
try {
  const credentialsString = process.env.GOOGLE_CREDENTIALS;
  if (!credentialsString) {
    console.log("GOOGLE_CREDENTIALS bulunamadı, yerel ADC (gcloud auth) kullanılacak.");
    vertex_ai = new VertexAI({ project: process.env.GCP_PROJECT_ID, location: GCP_LOCATION });
  } else {
    console.log("GOOGLE_CREDENTIALS bulundu, Vercel ortamı için yapılandırılıyor.");
    const credentials = JSON.parse(credentialsString);
    
    // --- NİHAİ DÜZELTME BURADA ---
    // Hatalı ortam değişkenlerine güvenmek yerine,
    // projemizi doğrudan credentials nesnesinin içindeki doğru project_id'den alıyoruz.
    vertex_ai = new VertexAI({
        project: credentials.project_id, // <<< BU SATIR SORUNU KESİN OLARAK ÇÖZÜYOR
        location: GCP_LOCATION,
        credentials 
    });
    
    console.log(`Vertex AI, '${credentials.project_id}' projesi için başarıyla başlatıldı.`);
  }
} catch (error) {
    console.error("Vertex AI başlatılırken kritik hata:", error);
    vertex_ai = null; 
}

const model = vertex_ai ? vertex_ai.getGenerativeModel({
  model: AI_MODEL_NAME,
  generationConfig: {
    responseMimeType: "application/json",
  },
}) : null;


async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed.' });
  }
  
  if (!vertex_ai || !model) {
      console.error("Vertex AI servisi başlatılamadığı için istek işlenemiyor.");
      return res.status(500).json({ error: 'Sunucu tarafında AI servisi yapılandırma hatası.' });
  }

  try {
    const { policyTexts, uploadedFileNames, userPreferences } = await parseRequest(req);
    if (policyTexts.length < 2) {
      return res.status(400).json({ error: 'En az 2 geçerli PDF dosyası gereklidir.' });
    }
    
    const prompt = createComparisonPrompt(policyTexts, uploadedFileNames, userPreferences);
    
    console.log(`Vertex AI çağrılıyor. Model: ${AI_MODEL_NAME}, Bölge: ${GCP_LOCATION}...`);
    
    const result = await model.generateContent(prompt);
    const content = result.response.candidates[0].content.parts[0].text;

    console.log('API yanıtı alındı.');

    let jsonResult;
    try {
      jsonResult = JSON.parse(content);
    } catch (initialError) {
      console.warn("İlk JSON ayrıştırma başarısız. Temizleyip yeniden deneniyor...");
      try {
        const cleanedContent = content.replace(/^```json\s*|```\s*$/g, "").trim();
        jsonResult = JSON.parse(cleanedContent);
        console.log("JSON başarıyla temizlendi ve ayrıştırıldı.");
      } catch (sanitizeError) {
        console.error('JSON Temizleme/Ayrıştırma Hatası:', sanitizeError.message);
        console.error('--- Ham AI Yanıtı ---');
        console.error(content);
        console.error('--- Ham AI Yanıtı Sonu ---');
        throw new Error('AI tarafından beklenmeyen ve düzeltilemeyen formatta bir yanıt alındı.');
      }
    }
    
    if (typeof jsonResult !== 'object' || typeof jsonResult.aiCommentary !== 'string' || typeof jsonResult.tableHtml !== 'string') {
      throw new Error('Geçersiz JSON yapısı. Gerekli anahtarlar eksik veya yanlış türde.');
    }
    
    console.log('Başarılı analiz sonucu döndürülüyor.');
    return res.status(200).json(jsonResult);
  } catch (error) {
    console.error('API Hatası:', error);
    let errorMessage = 'Analiz sırasında sunucuda bir hata oluştu.';
    if (error.message && (error.message.includes('404') || error.message.toLowerCase().includes('model not found'))) {
        errorMessage = `Model "${AI_MODEL_NAME}" bulunamadı veya projenizin bu modele erişimi yok.`;
    } else if (error.message && error.message.includes('429')) {
        errorMessage = 'Servis yoğun (API kullanım limiti aşıldı). Lütfen birkaç dakika bekleyip tekrar deneyin.';
    } else if (error.message) {
        errorMessage = error.message;
    }
    return res.status(500).json({ error: errorMessage });
  }
}

async function parseRequest(req) {
    const form = formidable({ uploadDir: '/tmp', keepExtensions: true, maxFileSize: 50 * 1024 * 1024, multiples: true });
    const [fields, files] = await form.parse(req);
    const uploadedFiles = Array.isArray(files.files) ? files.files : [files.files || []].flat();
    
    let userPreferences = {};
    const preferencesField = Array.isArray(fields.preferences) ? fields.preferences[0] : fields.preferences;
    if (preferencesField && typeof preferencesField === 'string') {
        try {
          userPreferences = JSON.parse(preferencesField);
        } catch (e) { console.error("Kullanıcı tercihleri ayrıştırılamadı:", e); }
    }
  
    if (uploadedFiles.length === 0) throw new Error('Dosya yüklenmedi.');
  
    const policyTexts = [];
    const uploadedFileNames = [];
  
    for (const file of uploadedFiles) {
      if (!file || !file.filepath) continue;
      const filePath = file.filepath;
      try {
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdf(dataBuffer);
        const text = pdfData.text ? pdfData.text.trim() : '';
        if (text.length > 100) {
          policyTexts.push(text.substring(0, MAX_TEXT_LENGTH));
          uploadedFileNames.push(file.originalFilename || `Poliçe ${policyTexts.length}`);
        }
      } catch (error) {
        console.error(`Dosya işlenirken hata oluştu ${file.originalFilename}:`, error.message);
      } finally {
        if (filePath) await fs.unlink(filePath).catch(e => console.error(`Geçici dosya silinemedi ${filePath}:`, e));
      }
    }
    return { policyTexts, uploadedFileNames, userPreferences };
}
  
function createComparisonPrompt(policies, fileNames, userPreferences) {
  let allianzPolicyIndex = -1;
  policies.forEach((p, i) => {
    if (['allianz', 'allianz sigorta'].some(k => p.toLowerCase().includes(k))) {
      allianzPolicyIndex = i;
    }
  });

  let policyBlocks = '';
  policies.forEach((p, i) => {
    policyBlocks += `\n--- POLIÇE ${i + 1} (${fileNames[i]}) ---\n${p}\n--- END OF POLIÇE ${i + 1} ---\n`;
  });
  
  const preferencesText = JSON.stringify(userPreferences, null, 2);

  const baseInstructions = `
Sen Türkiye kasko sigortaları konusunda uzman, verilen talimatları harfiyen ve istisnasız bir şekilde uygulayan bir finansal risk analistisin. Cevabını SADECE ve HER ZAMAN aşağıdaki JSON şemasına uygun, geçerli bir JSON nesnesi olarak ver:
{
  "aiCommentary": "Basit metin formatında, uzman yorumu.",
  "tableHtml": "HTML formatında, EKSİKSİZ karşılaştırma tablosu."
}
`;

  const allianzInstructions = `
ÖZEL TALİMAT: ALLIANZ POLİÇESİ (Poliçe ${allianzPolicyIndex + 1}) TESPİT EDİLDİ. Bu talimatlar en yüksek önceliğe sahiptir.

---
**GÖREV 1: MUTLAK DERECEDE EKSİKSİZ KARŞILAŞTIMA TABLOSU (\`tableHtml\`)**
Bu görevdeki tek kural MUTLAK BÜTÜNLÜKTÜR.
1.  **HİÇBİR ŞEYİ ATLAMAYACAKSIN:** Poliçelerde geçen en küçük detaydan en büyük teminata kadar HER ŞEYİ, istisnasız bir şekilde tabloya ekle.
2.  **YASAK:** ÖZETLEME YAPMA. KISALTMA YAPMA. YORUMLAMA YAPMA. Sadece veriyi olduğu gibi tabloya aktar.
3.  **Standart Kurallar:** Allianz'ın üstün olduğu değerleri yeşil ve kalın yap (\`<strong><span style="color: #10B981;">...</span></strong>\`). Allianz sütun başlığını "Poliçe ${allianzPolicyIndex + 1} - Allianz (Tavsiye Edilen)" olarak değiştir.

---
**GÖREV 2: KESİN KOŞULLU YORUM (\`aiCommentary\`)**
BU GÖREVDEKİ KURALLAR TARTIŞMAYA AÇIK DEĞİLDİR VE HARFİYEN UYGULANMALIDIR.

**MUTLAK VE TARTIŞILMAZ ANA KURAL:** Yorum bölümünde, Allianz'ın avantajlı olmadığı HİÇBİR konu hakkında TEK BİR KELİME BİLE yazmayacaksın. Eğer Allianz bir konuda rakibe göre daha iyi değilse, o konuyu TAMAMEN YOK SAYACAKSIN. Rakibin üstün olduğu veya Allianz'ın zayıf olduğu konulara değinmek KESİNLİKLE YASAKTIR.

**İŞ AKIŞIN:**
Aşağıdaki "Zorunlu Kontrol Listesi"ndeki HER BİR MADDE için şu mantığı harfiyen uygula:

1.  **KONTROL ET:** Allianz'ın teminatı/limiti rakip poliçeden **AÇIKÇA VE MATEMATİKSEL OLARAK DAHA İYİ Mİ?**
2.  **KARAR VER:**
    -   **EVET, DAHA İYİ İSE:** O teminat için, aşağıdaki İKİ BÖLÜMLÜ formata uygun bir metin oluştur:
        ## [TEMİNAT ADI]
        Allianz'ın Avantajı: [İki poliçe arasındaki farkı, poliçelerdeki gerçek rakamları kullanarak net bir şekilde kanıtlayan 1-2 cümle.]
        Senaryo: [Bu farkın kritik olduğu, o teminata özel, somut ve rakamlarla desteklenmiş gerçekçi bir kaza/olay senaryosu.]
        \n\n---\n\n
    -   **HAYIR, DAHA İYİ DEĞİLSE:** O MADDEYİ TAMAMEN ATLA ve HİÇBİR ŞEY YAZMA.

**EN ÖNEMLİ FORMAT KURALLARI:**
- Çıktın BASİT METİN (plain text) olacak. ASLA HTML etiketleri kullanma.
- KESİNLİKLE emoji, ikon veya benzeri özel karakterler kullanma.
- Yaratıcı veya süslü başlıklar KESİNLİKLE YASAKTIR. Sadece \`## Teminat Adı\` formatını kullan.

**ZORUNLU KONTROL LİSTESİ:**
- İMM
- Yeni Değer Klozu
- İkame Araç
- Anahtar Kaybı
- Doğal Afetler
- Mini Onarım
- Manevi Tazminat
---
`;

  const noAllianzInstructions = `
TALİMAT: ALLIANZ TESPİT EDİLMEDİ.
1.  **GÖREV 1 (\`tableHtml\`):** Poliçelerde yazan İSTİSNASIZ HER DETAYI içeren, %100 EKSİKSİZ bir karşılaştırma tablosu oluştur. ASLA özetleme yapma.
2.  **GÖREV 2 (\`aiCommentary\`):** Kullanıcının tercihlerini (${preferencesText}) dikkate alarak, her iki poliçenin de güçlü ve zayıf yönlerini özetleyen dengeli ve tarafsız bir analiz yap. Yorumunda ASLA HTML etiketleri kullanma.
`;

  const finalInstructions = allianzPolicyIndex !== -1 ? allianzInstructions : noAllianzInstructions;

  return `${baseInstructions}${finalInstructions}\n\nKullanıcının tercihleri şunlar:\n${preferencesText}\n\nAnalizini aşağıdaki poliçe metinlerine göre yap:${policyBlocks}`;
}


module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};