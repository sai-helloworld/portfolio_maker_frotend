// Change this to match your Django API server address if deployed
const API_BASE_URL = 'http://127.0.0.1:8000/api';

let currentStep = 1;

function nextStep(step) {
    document.getElementById(`step${currentStep}`).classList.remove('active');
    document.getElementById(`step${step}`).classList.add('active');
    currentStep = step;
}

function prevStep(step) {
    document.getElementById(`step${currentStep}`).classList.remove('active');
    document.getElementById(`step${step}`).classList.add('active');
}

async function generatePortfolio() {
    const generateBtn = document.getElementById('generateBtn');
    const loader = document.getElementById('loader');

    const payload = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        technologies: document.getElementById('technologies').value,
        projects: document.getElementById('projects').value,
        achievements: document.getElementById('achievements').value,
        preferred_style: document.getElementById('preferred_style').value
    };

    generateBtn.disabled = true;
    loader.style.display = 'block';

    try {
        const response = await fetch(`${API_BASE_URL}/generate-portfolio/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            downloadFile(result.html, `${payload.name.toLowerCase().replace(/\s+/g, '_')}_portfolio.html`);
        } else {
            alert("Error: " + (result.error || "Failed to generate website."));
        }
    } catch (err) {
        alert("Could not connect to Django API server.");
        console.error(err);
    } finally {
        generateBtn.disabled = false;
        loader.style.display = 'none';
    }
}

function downloadFile(content, fileName) {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}