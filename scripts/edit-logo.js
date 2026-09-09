const fs = require('fs');
const ZAI = require('z-ai-web-dev-sdk').default;

async function editLogo() {
  const zai = await ZAI.create();

  // Read the uploaded logo as base64
  const imageBuffer = fs.readFileSync('/home/z/my-project/upload/ChatGPT Image Jul 24, 2026, 04_43_44 PM.png');
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64Image}`;

  const response = await zai.images.generations.edit({
    prompt: 'Transform this logo into a vibrant green gradient version. Keep the exact same logo design, shape, icons, text and layout but change ALL colors to green/emerald gradient tones (#10B981, #059669, #22C55E). Make it professional, modern, vibrant with rich green gradients, transparent/white background, high quality',
    images: [{ url: dataUrl }],
    size: '1024x1024'
  });

  const outputBase64 = response.data[0].base64;
  const outputBuffer = Buffer.from(outputBase64, 'base64');
  fs.writeFileSync('/home/z/my-project/public/images/logo-3boxes-hrms.png', outputBuffer);
  console.log('Green gradient logo saved!');
}

editLogo().catch(console.error);
