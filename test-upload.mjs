import fs from 'fs';

async function test() {
    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync('package.json')], { type: 'text/plain' });
    formData.append('file', fileBlob, 'package.json');
    formData.append('folder', 'materials_model19');

    try {
        const res = await fetch('http://localhost:3000/api/images/upload', {
            method: 'POST',
            body: formData
        });
        const json = await res.json();
        console.log("RESPONSE:", JSON.stringify(json, null, 2));
    } catch(err) {
        console.error("ERROR:", err);
    }
}
test();
