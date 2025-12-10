import React, { useState } from 'react';
import { FileDown, Loader2, Settings, FileText, Download, BookOpen, GraduationCap } from 'lucide-react';

const ExamGenerator = () => {
  const [settings, setSettings] = useState({
    jenjang: '',
    mataPelajaran: '',
    materi: '',
    jumlahSoal: 10,
    tipeJawaban: 'pilihan-ganda',
    tingkatKesulitan: 'sedang',
    gunakanGambar: false
  });
  
  const [questions, setQuestions] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const jenjangOptions = [
    '4 SD', '5 SD', '6 SD',
    '1 SMP', '2 SMP', '3 SMP',
    '1 SMA', '2 SMA', '3 SMA'
  ];

  const mataPelajaranByJenjang = {
    'SD': ['Matematika', 'IPA', 'IPS', 'Bahasa Indonesia', 'Bahasa Inggris', 'PKn'],
    'SMP': ['Matematika', 'IPA', 'IPS', 'Bahasa Indonesia', 'Bahasa Inggris', 'PKn', 'Seni Budaya', 'PJOK'],
    'SMA': ['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Ekonomi', 'Geografi', 'Sosiologi', 'Sejarah', 'Bahasa Indonesia', 'Bahasa Inggris', 'PKn']
  };

  const getMataPelajaranOptions = () => {
    if (!settings.jenjang) return [];
    const tingkat = settings.jenjang.includes('SD') ? 'SD' : 
                    settings.jenjang.includes('SMP') ? 'SMP' : 'SMA';
    return mataPelajaranByJenjang[tingkat] || [];
  };

  const generateQuestions = async () => {
    setIsGenerating(true);
    
    try {
      const pgKompleksInstruction = settings.tipeJawaban === 'pilihan-ganda-kompleks' 
        ? `

PENTING untuk Pilihan Ganda Kompleks:
- Buat 4 pernyataan dengan format: {"a": "pernyataan A...", "b": "pernyataan B...", "c": "pernyataan C...", "d": "pernyataan D..."}
- Minimal 2 pernyataan harus BENAR, maksimal 3 pernyataan BENAR
- Field "jawaban" harus berisi kombinasi huruf yang benar, contoh: "A, B, D" atau "B, C" atau "A, C, D"
- Pastikan pernyataan yang benar dan salah tercampur acak, jangan semua benar di awal

Contoh format JSON untuk PG Kompleks:
{
  "soal": [
    {
      "nomor": 1,
      "pertanyaan": "Analyze the following sentences about passive voice transformation. Which statements are CORRECT?",
      "pilihan": {
        "a": "Passive voice always uses 'be + past participle'",
        "b": "The object of active voice becomes subject in passive",
        "c": "Passive voice can only be used in past tense",
        "d": "By-phrase in passive shows the original subject"
      },
      "jawaban": "A, B, D"
    }
  ]
}` 
        : '';

      const promptText = `Buatkan ${settings.jumlahSoal} soal ${settings.tipeJawaban} untuk siswa kelas ${settings.jenjang}, mata pelajaran ${settings.mataPelajaran}, materi ${settings.materi}, dengan tingkat kesulitan ${settings.tingkatKesulitan}.

${settings.gunakanGambar ? 'PENTING: Untuk SEMUA soal, WAJIB sertakan deskripsi detail gambar yang relevan dengan materi. Deskripsi harus spesifik, jelas, dan mudah divisualisasikan.' : 'Tidak perlu menyertakan gambar.'}${pgKompleksInstruction}

Format jawaban harus JSON dengan struktur:
{
  "soal": [
    {
      "nomor": 1,
      "pertanyaan": "teks pertanyaan",
      ${settings.gunakanGambar ? '"deskripsiGambar": "deskripsi gambar (wajib)",' : ''}
      ${settings.tipeJawaban === 'pilihan-ganda' ? '"pilihan": {"a": "...", "b": "...", "c": "...", "d": "..."},' : ''}
      ${settings.tipeJawaban === 'pilihan-ganda-kompleks' ? '"pilihan": {"a": "pernyataan A", "b": "pernyataan B", "c": "pernyataan C", "d": "pernyataan D"},' : ''}
      ${settings.tipeJawaban === 'benar-salah' ? '"pilihan": {"benar": "...", "salah": "..."},' : ''}
      "jawaban": "${settings.tipeJawaban === 'pilihan-ganda-kompleks' ? 'A, B, D (kombinasi huruf yang benar)' : settings.tipeJawaban === 'pilihan-ganda' ? 'a (satu huruf)' : 'kunci jawaban'}"
    }
  ]
}

Respons HANYA dalam format JSON, tanpa teks tambahan atau penjelasan.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          messages: [
            { role: 'user', content: promptText }
          ]
        })
      });

      const data = await response.json();
      const content = data.content[0].text;
      
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanContent);
      
      const questionsWithImages = await Promise.all(
        (parsed.soal || []).map(async (q) => {
          if (settings.gunakanGambar && q.deskripsiGambar) {
            try {
              const imageUrl = await generateImage(q.deskripsiGambar, settings.mataPelajaran);
              return { ...q, gambarUrl: imageUrl };
            } catch (err) {
              console.error('Error generating image for question', q.nomor, ':', err);
              return q;
            }
          }
          return q;
        })
      );
      
      setQuestions(questionsWithImages);
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Gagal membuat soal. Silakan coba lagi.');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImage = async (description, subject) => {
    try {
      const imagePrompt = `Create a simple, clear SVG educational diagram for ${subject}. Description: ${description}. Use viewBox 0 0 500 350. Return ONLY the complete SVG code.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [
            { role: 'user', content: imagePrompt }
          ]
        })
      });

      const data = await response.json();
      let svgContent = data.content[0].text.trim();
      
      svgContent = svgContent.replace(/```svg\n?|\n?```/g, '').trim();
      svgContent = svgContent.replace(/```xml\n?|\n?```/g, '').trim();
      svgContent = svgContent.replace(/```\n?|\n?```/g, '').trim();
      
      const svgMatch = svgContent.match(/<svg[\s\S]*?<\/svg>/i);
      if (svgMatch) {
        const cleanSvg = svgMatch[0];
        const encoded = btoa(unescape(encodeURIComponent(cleanSvg)));
        return `data:image/svg+xml;base64,${encoded}`;
      }
      
      console.warn('No valid SVG found in response');
      return null;
    } catch (error) {
      console.error('Error in generateImage:', error);
      return null;
    }
  };

  const downloadAsWord = () => {
    let content = `SOAL UJIAN
Kelas: ${settings.jenjang}
Mata Pelajaran: ${settings.mataPelajaran}
Materi: ${settings.materi}
Tingkat Kesulitan: ${settings.tingkatKesulitan.toUpperCase()}
Tipe Soal: ${settings.tipeJawaban.toUpperCase()}
Jumlah Soal: ${settings.jumlahSoal}

==========================================

`;

    questions.forEach((q) => {
      content += `${q.nomor}. ${q.pertanyaan}\n`;
      
      if (q.deskripsiGambar) {
        content += `   [GAMBAR: ${q.deskripsiGambar}]\n`;
      }
      
      if (settings.tipeJawaban === 'pilihan-ganda' && q.pilihan) {
        content += `   a. ${q.pilihan.a}\n`;
        content += `   b. ${q.pilihan.b}\n`;
        content += `   c. ${q.pilihan.c}\n`;
        content += `   d. ${q.pilihan.d}\n`;
      } else if (settings.tipeJawaban === 'pilihan-ganda-kompleks' && q.pilihan) {
        content += `   A. ${q.pilihan.a}\n`;
        content += `   B. ${q.pilihan.b}\n`;
        content += `   C. ${q.pilihan.c}\n`;
        content += `   D. ${q.pilihan.d}\n`;
      } else if (settings.tipeJawaban === 'benar-salah' && q.pilihan) {
        content += `   [ ] Benar\n`;
        content += `   [ ] Salah\n`;
      } else if (settings.tipeJawaban === 'essay') {
        content += `   ___________________________________________\n`;
        content += `   ___________________________________________\n`;
      }
      
      content += `\n`;
    });

    content += `\n\nKUNCI JAWABAN:\n==========================================\n\n`;
    questions.forEach((q) => {
      content += `${q.nomor}. ${q.jawaban}\n`;
    });

    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Soal_${settings.mataPelajaran}_${settings.jenjang}_${settings.tingkatKesulitan}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsPDF = () => {
    const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Soal Ujian</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #dc2626; padding-bottom: 20px; }
    .question { margin-bottom: 25px; page-break-inside: avoid; }
    .choices { margin-left: 30px; margin-top: 10px; }
    .answer-key { margin-top: 50px; border-top: 2px solid #dc2626; padding-top: 20px; }
    .image-container { text-align: center; margin: 15px 0; }
    .image-container img { max-width: 450px; border: 2px solid #ccc; border-radius: 8px; }
    .image-desc { font-size: 11px; color: #666; font-style: italic; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SOAL UJIAN</h1>
    <p><strong>Kelas:</strong> ${settings.jenjang}</p>
    <p><strong>Mata Pelajaran:</strong> ${settings.mataPelajaran}</p>
    <p><strong>Materi:</strong> ${settings.materi}</p>
    <p><strong>Tingkat Kesulitan:</strong> ${settings.tingkatKesulitan.toUpperCase()}</p>
    <p><strong>Tipe Soal:</strong> ${settings.tipeJawaban.toUpperCase()}</p>
    <p><strong>Jumlah Soal:</strong> ${settings.jumlahSoal}</p>
  </div>
  ${questions.map(q => {
    let questionHtml = `<div class="question"><p><strong>${q.nomor}.</strong> ${q.pertanyaan}</p>`;
    
    if (q.deskripsiGambar && q.gambarUrl) {
      questionHtml += `<div class="image-container"><img src="${q.gambarUrl}" alt="${q.deskripsiGambar}" /><p class="image-desc">${q.deskripsiGambar}</p></div>`;
    } else if (q.deskripsiGambar) {
      questionHtml += `<div class="image-desc" style="background: #fee; padding: 10px; margin: 10px 0;">[GAMBAR: ${q.deskripsiGambar}]</div>`;
    }
    
    if (settings.tipeJawaban === 'pilihan-ganda' && q.pilihan) {
      questionHtml += `<div class="choices"><p>a. ${q.pilihan.a}</p><p>b. ${q.pilihan.b}</p><p>c. ${q.pilihan.c}</p><p>d. ${q.pilihan.d}</p></div>`;
    } else if (settings.tipeJawaban === 'pilihan-ganda-kompleks' && q.pilihan) {
      questionHtml += `<div class="choices"><p>A. ${q.pilihan.a}</p><p>B. ${q.pilihan.b}</p><p>C. ${q.pilihan.c}</p><p>D. ${q.pilihan.d}</p></div>`;
    } else if (settings.tipeJawaban === 'benar-salah') {
      questionHtml += `<div class="choices"><p>[ ] Benar</p><p>[ ] Salah</p></div>`;
    } else if (settings.tipeJawaban === 'essay') {
      questionHtml += `<div class="choices"><p>_________________________________________________</p><p>_________________________________________________</p></div>`;
    }
    
    questionHtml += `</div>`;
    return questionHtml;
  }).join('')}
  <div class="answer-key">
    <h2>KUNCI JAWABAN</h2>
    ${questions.map(q => `<p><strong>${q.nomor}.</strong> ${q.jawaban}</p>`).join('')}
  </div>
</body>
</html>`;

    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Soal_${settings.mataPelajaran}_${settings.jenjang}_${settings.tingkatKesulitan}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canGenerate = settings.jenjang && settings.mataPelajaran && settings.materi.trim();

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-96 bg-white border-r border-gray-200 shadow-lg overflow-y-auto">
        <div className="bg-gradient-to-br from-red-600 to-red-700 p-6 text-white sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap size={32} />
            <h1 className="text-2xl font-bold">Generator Soal</h1>
          </div>
          <p className="text-sm opacity-90">AI untuk membuat soal ujian</p>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="text-red-600" size={20} />
            <h2 className="text-lg font-semibold text-gray-800">Pengaturan Soal</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jenjang Kelas
              </label>
              <select
                value={settings.jenjang}
                onChange={(e) => setSettings({...settings, jenjang: e.target.value, mataPelajaran: ''})}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="">Pilih Jenjang</option>
                {jenjangOptions.map(j => (
                  <option key={j} value={j}>{j}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mata Pelajaran
              </label>
              <select
                value={settings.mataPelajaran}
                onChange={(e) => setSettings({...settings, mataPelajaran: e.target.value})}
                disabled={!settings.jenjang}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">Pilih Mata Pelajaran</option>
                {getMataPelajaranOptions().map(mp => (
                  <option key={mp} value={mp}>{mp}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Materi
              </label>
              <input
                type="text"
                value={settings.materi}
                onChange={(e) => setSettings({...settings, materi: e.target.value})}
                placeholder="Contoh: Persamaan Linear, Fotosintesis, dll"
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tingkat Kesulitan
              </label>
              <select
                value={settings.tingkatKesulitan}
                onChange={(e) => setSettings({...settings, tingkatKesulitan: e.target.value})}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="mudah">Mudah</option>
                <option value="sedang">Sedang</option>
                <option value="sulit">Sulit</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jumlah Soal
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.jumlahSoal}
                  onChange={(e) => setSettings({...settings, jumlahSoal: parseInt(e.target.value) || 1})}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipe Jawaban
                </label>
                <select
                  value={settings.tipeJawaban}
                  onChange={(e) => setSettings({...settings, tipeJawaban: e.target.value})}
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="pilihan-ganda">Pilihan Ganda</option>
                  <option value="pilihan-ganda-kompleks">PG Kompleks</option>
                  <option value="benar-salah">Benar Salah</option>
                  <option value="essay">Essay</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <input
                type="checkbox"
                id="gambar"
                checked={settings.gunakanGambar}
                onChange={(e) => setSettings({...settings, gunakanGambar: e.target.checked})}
                className="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-500"
              />
              <label htmlFor="gambar" className="text-sm font-medium text-gray-700 cursor-pointer">
                Sertakan gambar ilustrasi
              </label>
            </div>

            <button
              onClick={generateQuestions}
              disabled={!canGenerate || isGenerating}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3 rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Generating...
                </>
              ) : (
                <>
                  <FileText size={20} />
                  Generate Soal
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {questions.length === 0 && !isGenerating ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <BookOpen className="mx-auto text-gray-300 mb-4" size={80} />
              <h2 className="text-2xl font-semibold text-gray-600 mb-2">Belum Ada Soal</h2>
              <p className="text-gray-500">Atur parameter di sidebar dan klik Generate Soal</p>
            </div>
          </div>
        ) : isGenerating ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="animate-spin text-red-600 mx-auto mb-4" size={64} />
              <h2 className="text-2xl font-semibold text-gray-700 mb-2">Sedang Membuat Soal...</h2>
              <p className="text-gray-500">Mohon tunggu, AI sedang bekerja</p>
              {settings.gunakanGambar && (
                <p className="text-sm text-gray-400 mt-2">Generating gambar untuk setiap soal...</p>
              )}
            </div>
          </div>
        ) : (
          <div className="p-8">
            <div className="max-w-5xl mx-auto">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
                <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 text-white">
                  <h2 className="text-2xl font-bold">Hasil Generate Soal</h2>
                  <p className="text-sm opacity-90 mt-1">{questions.length} soal berhasil dibuat</p>
                </div>

                <div className="p-6 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-700">Kelas:</span>
                      <span className="ml-2 text-gray-600">{settings.jenjang}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Mapel:</span>
                      <span className="ml-2 text-gray-600">{settings.mataPelajaran}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Materi:</span>
                      <span className="ml-2 text-gray-600">{settings.materi}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Kesulitan:</span>
                      <span className="ml-2 text-gray-600 capitalize">{settings.tingkatKesulitan}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Tipe:</span>
                      <span className="ml-2 text-gray-600 capitalize">{settings.tipeJawaban}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700">Gambar:</span>
                      <span className="ml-2 text-gray-600">{settings.gunakanGambar ? 'Ya' : 'Tidak'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex gap-3 mb-6">
                    <button
                      onClick={downloadAsWord}
                      className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download size={20} />
                      Download Word
                    </button>
                    <button
                      onClick={downloadAsPDF}
                      className="flex-1 bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <FileDown size={20} />
                      Download HTML
                    </button>
                  </div>

                  <div className="space-y-5">
                    {questions.map((q, idx) => (
                      <div key={idx} className="border-2 border-gray-200 rounded-xl p-6 bg-white hover:shadow-md transition-shadow">
                        <p className="font-semibold text-gray-800 text-lg mb-3">
                          {q.nomor}. {q.pertanyaan}
                        </p>
                        
                        {q.deskripsiGambar && (
                          <div className="mb-4">
                            {q.gambarUrl ? (
                              <div className="text-center">
                                <img 
                                  src={q.gambarUrl} 
                                  alt={q.deskripsiGambar}
                                  className="max-w-md mx-auto border-2 border-gray-300 rounded-lg shadow-sm"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'block';
                                  }}
                                />
                                <div className="hidden bg-red-50 border border-red-200 rounded p-3 text-sm italic text-gray-700">
                                  [GAMBAR: {q.deskripsiGambar}]
                                </div>
                                <p className="text-xs text-gray-500 mt-2 italic">
                                  {q.deskripsiGambar}
                                </p>
                              </div>
                            ) : (
                              <div className="bg-red-50 border border-red-200 rounded p-3 text-sm italic text-gray-700">
                                [GAMBAR: {q.deskripsiGambar}]
                              </div>
                            )}
                          </div>
                        )}
                        
                        {settings.tipeJawaban === 'pilihan-ganda' && q.pilihan && (
                          <div className="ml-6 space-y-2 text-gray-700">
                            <p className="hover:bg-gray-50 p-2 rounded">a. {q.pilihan.a}</p>
                            <p className="hover:bg-gray-50 p-2 rounded">b. {q.pilihan.b}</p>
                            <p className="hover:bg-gray-50 p-2 rounded">c. {q.pilihan.c}</p>
                            <p className="hover:bg-gray-50 p-2 rounded">d. {q.pilihan.d}</p>
                          </div>
                        )}
                        
                        {settings.tipeJawaban === 'pilihan-ganda-kompleks' && q.pilihan && (
                          <div className="ml-6 space-y-2 text-gray-700">
                            <p className="hover:bg-gray-50 p-2 rounded">A. {q.pilihan.a}</p>
                            <p className="hover:bg-gray-50 p-2 rounded">B. {q.pilihan.b}</p>
                            <p className="hover:bg-gray-50 p-2 rounded">C. {q.pilihan.c}</p>
                            <p className="hover:bg-gray-50 p-2 rounded">D. {q.pilihan.d}</p>
                          </div>
                        )}
                        
                        {settings.tipeJawaban === 'benar-salah' && (
                          <div className="ml-6 text-gray-700 space-y-2">
                            <p className="hover:bg-gray-50 p-2 rounded">[ ] Benar</p>
                            <p className="hover:bg-gray-50 p-2 rounded">[ ] Salah</p>
                          </div>
                        )}
                        
                        {settings.tipeJawaban === 'essay' && (
                          <div className="ml-6 text-gray-500 space-y-2">
                            <p>_________________________________________________</p>
                            <p>_________________________________________________</p>
                          </div>
                        )}
                        
                        <div className="mt-4 pt-4 border-t border-gray-200 bg-green-50 rounded p-3">
                          <p className="text-sm text-gray-700">
                            <span className="font-semibold text-green-700">Jawaban:</span> {q.jawaban}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamGenerator;