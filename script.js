const API_BASE_URL = 'http://127.0.0.1:8000/api';

let currentStep = 1;
let generatedTemplateHtml = "";
let currentRenderedHtml = "";

function navigateToStep(step) {
    document.getElementById(`step${currentStep}`).classList.remove('active');
    document.getElementById(`step${step}`).classList.add('active');
    currentStep = step;
}

function showLoader(text) {
    const loader = document.getElementById('loader');
    loader.innerText = text;
    loader.style.display = 'block';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

// PHASE 1: Send style choices to Groq via DRF
async function generateAITemplate() {
    const designPayload = {
        style: document.getElementById('style_select').value,
        color_palette: document.getElementById('palette_input').value,
        typography: document.getElementById('font_select').value,
        animation_level: document.getElementById('animation_select').value
    };

    showLoader("✨ Phase 1: Generating UI Design Template via Groq...");

    try {
        const response = await fetch(`${API_BASE_URL}/generate-template/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(designPayload)
        });

        const data = await response.json();

        if (data.success) {
            generatedTemplateHtml = data.template_html;
            navigateToStep(2);
        } else {
            alert("Error generating design: " + data.error);
        }
    } catch (err) {
        alert("Could not connect to Django API backend.");
        console.error(err);
    } finally {
        hideLoader();
    }
}

// Helper to collect dynamic projects from DOM
function getProjectsFromForm() {
    const projectItems = document.querySelectorAll('.project-item');
    const projects = [];

    projectItems.forEach(item => {
        const title = item.querySelector('.proj_title').value;
        const description = item.querySelector('.proj_desc').value;
        const link = item.querySelector('.proj_link').value;

        if (title.trim() !== "") {
            projects.push({ title, description, link });
        }
    });

    return projects;
}

function addProjectField() {
    const container = document.getElementById('projects_container');
    const div = document.createElement('div');
    div.className = 'dynamic-item project-item';
    div.innerHTML = `
        <input type="text" class="proj_title" placeholder="Project Title" style="margin-bottom:0.5rem;">
        <textarea class="proj_desc" rows="2" placeholder="Project Description" style="margin-bottom:0.5rem;"></textarea>
        <input type="text" class="proj_link" placeholder="Project Link">
    `;
    container.appendChild(div);
}

// PHASE 3: Send template + user JSON payload to Python Jinja Engine
async function renderFinalPortfolio() {
    if (!generatedTemplateHtml) {
        alert("Please generate a design template first.");
        return;
    }

    const userData = {
        name: document.getElementById('field_name').value || "John Doe",
        title: document.getElementById('field_title').value || "Software Engineer",
        tagline: document.getElementById('field_tagline').value || "Building intelligent web systems.",
        about_me: document.getElementById('field_about').value || "Passionate about software architecture.",
        email: document.getElementById('field_email').value || "john@example.com",
        github: document.getElementById('field_github').value || "https://github.com",
        linkedin: document.getElementById('field_linkedin').value || "https://linkedin.com",
        skills: document.getElementById('field_skills').value.split(',').map(s => s.trim()).filter(s => s),
        projects: getProjectsFromForm(),
        experience: [],
        education: []
    };

    showLoader("⚡ Phase 3: Injecting JSON Data with Python Jinja2...");

    try {
        const response = await fetch(`${API_BASE_URL}/render-portfolio/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                template_html: generatedTemplateHtml,
                user_data: userData
            })
        });

        const data = await response.json();

        if (data.success) {
            currentRenderedHtml = data.rendered_html;
            document.getElementById('preview_iframe').srcdoc = currentRenderedHtml;
            navigateToStep(4);
        } else {
            alert("Rendering Error: " + data.error);
        }
    } catch (err) {
        alert("Could not reach Python Jinja renderer.");
        console.error(err);
    } finally {
        hideLoader();
    }
}

// Trigger browser download of rendered HTML file
function downloadPortfolio() {
    if (!currentRenderedHtml) {
        alert("No rendered website available.");
        return;
    }

    const blob = new Blob([currentRenderedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}