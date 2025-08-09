// api/analyze.js - Vercel Serverless Function (SON GÜNCEL VERSİYON)
const { formidable } = require('formidable'); // <<< DÜZELTME BURADA
const fs = require('fs').promises;
const pdf = require('pdf-parse');
const OpenAI = require('openai');

// OpenAI client'ı
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Ayarlar
const MAX_TEXT_LENGTH = 15000; // API token limitini aşmamak için karakter limiti
const AI_MODEL = "gpt-4o-mini"; // "gpt-3.5-turbo" yerine daha yetenekli ve uygun fiyatlı yeni model

// Ana handler fonksiyonu
async function handler(req, res) {
  // CORS ayarları (Vercel için standart)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Sadece POST metotlarını kabul et
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are accepted.' });
  }

  try {
    const { policyTexts, uploadedFileNames } = await parseAndExtractPdfTexts(req);

    if (policyTexts.length < 2) {
      return res.status(400).json({ error: 'En az 2 geçerli ve okunabilir PDF dosyası gereklidir.' });
    }
    
    // DEBUG Modu: OPENAI_API_KEY yoksa test verisi döndür
    if (!process.env.OPENAI_API_KEY) {
      console.log('Running in test mode (no OpenAI API key)');
      const testResponse = generateTestResponse(policyTexts, uploadedFileNames);
      return res.status(200).json(testResponse);
    }
    
    // OpenAI için prompt oluştur
    const prompt = createComparisonPrompt(policyTexts, uploadedFileNames);
    
    console.log('Calling OpenAI API with a new powerful prompt...');
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: 'Sen Türkiye kasko sigortaları konusunda uzman bir analiz danışmanısın. Cevapların her zaman istenen JSON formatında olmalı. HTML kullanırken temiz ve basit etiketler kullan.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2, // Daha tutarlı ve analitik cevaplar için
      max_tokens: 3000, // Daha uzun ve detaylı cevaplara izin ver
      response_format: { type: "json_object" }, // JSON çıktısını garanti eder
    });

    const content = completion.choices[0].message.content;
    console.log('API Response received.');

    // JSON'u parse et ve doğrula
    let result;
    try {
      result = JSON.parse(content);
      if (typeof result !== 'object' || !result.aiCommentary || !result.tableHtml) {
        throw new Error('Invalid JSON structure from AI');
      }
    } catch (e) {
      console.error('JSON Parse Error:', e.message);
      throw new Error('AI tarafından geçersiz formatta yanıt alındı.');
    }
    
    console.log('Returning successful analysis.');
    return res.status(200).json(result);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Analiz sırasında sunucuda bir hata oluştu.' });
  }
}

async function parseAndExtractPdfTexts(req) {
  const form = formidable({ // Bu satır artık doğru çalışacak
    uploadDir: '/tmp',
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024,
    multiples: true
  });

  const [fields, files] = await form.parse(req);
  const uploadedFiles = Array.isArray(files.files) ? files.files : [files.files || []];
  
  if (uploadedFiles.length === 0) {
      throw new Error('Dosya yüklenmedi.');
  }

  const policyTexts = [];
  const uploadedFileNames = [];

  for (const file of uploadedFiles) {
    const filePath = file.filepath;
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdf(dataBuffer);
      const text = pdfData.text ? pdfData.text.trim() : '';

      if (text.length > 100) { // Sadece anlamlı metin içerenleri al
        policyTexts.push(text.substring(0, MAX_TEXT_LENGTH));
        uploadedFileNames.push(file.originalFilename || `Poliçe ${policyTexts.length}`);
      }
    } catch (error) {
      console.error(`Error processing file ${file.originalFilename}:`, error.message);
    } finally {
      // Geçici dosyayı sil
      await fs.unlink(filePath).catch(e => console.error(`Failed to delete temp file ${filePath}:`, e));
    }
  }

  return { policyTexts, uploadedFileNames };
}

function createComparisonPrompt(policies, fileNames) {
  let allianzPolicyIndex = -1;
  policies.forEach((p, i) => {
    if (p.toLowerCase().includes('allianz')) {
      allianzPolicyIndex = i;
    }
  });

  let policyBlocks = '';
  policies.forEach((p, i) => {
    policyBlocks += `
--- POLIÇE ${i + 1} (${fileNames[i]}) ---
${p}
--- END OF POLIÇE ${i + 1} ---\n\n`;
  });

  const baseInstructions = `
Aşağıda metinleri verilen ${policies.length} adet kasko sigortası poliçesini karşılaştır.
Cevabını BANA SADECE aşağıdaki JSON formatında ver:
{
  "aiCommentary": "HTML formatında, paragraflar için <p>, listeler için <ul><li> etiketleri kullanarak yazılmış detaylı uzman yorumu ve tavsiye.",
  "tableHtml": "HTML formatında, <thead> ve <tbody> içeren bir karşılaştırma tablosu. En önemli 10-15 özelliği karşılaştır. Bir değer diğerine göre daha avantajlı ise onu strong etiketi ve 'color: #10B981;' (yeşil) ile vurgula. Örneğin: '<td><strong style=\\"color: #10B981;\\">15.000 TL</strong></td>'. Eğer bir bilgi yoksa 'Belirtilmemiş' yaz."
}

Analizinde şu adımları izle:
1.  **Tablo Oluşturma:** Her poliçenin en kritik özelliklerini (Poliçe Fiyatı/Prim, Kasko Değeri, Çarpışma Teminatı, Mini Onarım Hizmeti, İkame Araç Süresi, Muafiyet Oranları, Cam Değişimi Limiti, Asistans Hizmetleri vb.) içeren bir HTML tablosu hazırla. Değerleri doğrudan metinden çıkar.
2.  **Yorum Yazma:** aiCommentary alanına, bir uzman gibi detaylı bir analiz yaz.
    a. Genel bir karşılaştırma ile başla.
    b. Her poliçenin güçlü ve zayıf yönlerini belirt.
    c. Fiyat/performans açısından en mantıklı poliçeyi belirle ve nedenlerini açıkla.
`;

  const allianzInstructions = `
ÖNEMLİ GÖREV: Analizinde Poliçe ${allianzPolicyIndex + 1}'in bir Allianz Sigorta poliçesi olduğunu fark ettim. Bu yüzden analizini şu şekilde derinleştir:
1.  **Allianz'a Özel Vurgu:** 'aiCommentary' bölümünde, Allianz poliçesinin metninde bulduğun spesifik avantajları (örneğin daha kapsamlı asistans hizmetleri, daha yüksek limitli mini onarım, markaya özel servis ağı gibi) DETAYLICA açıkla. Genel övgülerden kaçın, SADECE poliçe metnindeki kanıtlara odaklan.
2.  **"Neden Allianz Seçilmeli?" Başlığı:** Yorumunun sonuna "<h4>🏆 Neden Allianz Poliçesi Tercih Edilmeli?</h4>" şeklinde bir başlık ekle. Bu başlığın altına, diğer poliçelere kıyasla Allianz poliçesini seçmek için en önemli 3-4 sebebi maddeler halinde, somut verilere dayanarak sırala.
3.  **Tabloda İşaretleme:** HTML tablosunda Allianz poliçesinin olduğu sütun başlığına " (Tavsiye Edilen)" ifadesini ekle. Örn: <th>Poliçe ${allianzPolicyIndex + 1} - Allianz (Tavsiye Edilen)</th>
`;
  
  const finalPrompt = baseInstructions + (allianzPolicyIndex !== -1 ? allianzInstructions : '') + `\n\nİşte poliçe metinleri:\n${policyBlocks}`;
  
  return finalPrompt;
}

function generateTestResponse(policies, fileNames) {
    const hasAllianz = policies.some(p => p.toLowerCase().includes('allianz'));
    const allianzIndex = policies.findIndex(p => p.toLowerCase().includes('allianz'));
    let tableHeader = '<th>Özellik</th>';
    let tableBody = `<tr><td>Dosya Adı</td>`;

    fileNames.forEach((name, i) => {
        let title = `Poliçe ${i+1}`;
        if (i === allianzIndex) {
            title = `✅ ${name} (ÖNERİLEN)`;
        }
        tableHeader += `<th>${title}</th>`;
        tableBody += `<td>${name}</td>`;
    });
    tableBody += '</tr>';

    return {
        aiCommentary: hasAllianz ? 
          `<h4>🏆 Allianz Sigorta Tespit Edildi! (Test Modu)</h4>
          <p><strong>Poliçe ${allianzIndex + 1}</strong> bir Allianz Sigorta poliçesidir. Bu, genellikle geniş servis ağı ve güvenilir hizmet anlamına gelir.</p>
          <h4>⭐ Tavsiyemiz</h4>
          <p><strong>Allianz Sigorta'yı tercih etmenizi öneriyoruz!</strong> Bu bir test yanıtıdır. Gerçek analiz için API anahtarınızı ekleyin.</p>` :
          `<h4>📊 Poliçe Karşılaştırması (Test Modu)</h4>
          <p>Poliçeleriniz başarıyla yüklendi. Bu bir test yanıtıdır. Gerçek analiz için API anahtarınızı ekleyin.</p>`,
        tableHtml: `<thead><tr>${tableHeader}</tr></thead>
        <tbody>
          ${tableBody}
          <tr><td>Durum</td>${policies.map(()=>'<td>✓ Yüklendi</td>').join('')}</tr>
          <tr><td>Metin Uzunluğu</td>${policies.map(p=>`<td>${p.length} karakter</td>`).join('')}</tr>
        </tbody>`
    };
}


module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};