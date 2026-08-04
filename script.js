// ============ CONFIGURATION ============
const BASE_NGROK_URL = 'https://guide-lark-flannels.ngrok-free.dev';
const API_BASE_URL = `${BASE_NGROK_URL}/api`;

let currentStep = 1;
let generatedTemplateHtml = "";
let currentRenderedHtml = "";
let authTokens = {
    access: null,
    refresh: null
};
let currentUser = null;

const defaultHeaders = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420'
};

// ============ AUTHENTICATION HELPERS ============

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
    
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`${tab}Form`).classList.add('active');
    
    hideAlert();
}

function showAlert(message, type = 'error') {
    const alert = document.getElementById('authAlert');
    if (alert) {
        alert.textContent = message;
        alert.className = `alert alert-${type} show`;
    }
}

function hideAlert() {
    const alert = document.getElementById('authAlert');
    if (alert) alert.className = 'alert';
}

function showLoader(text = 'Processing...') {
    const loaderText = document.getElementById('loaderText');
    const loader = document.getElementById('loader');
    if (loaderText) loaderText.textContent = text;
    if (loader) loader.classList.add('show');
}

function hideLoader() {
    const loader = document.getElementById('loader');
    if (loader) loader.classList.remove('show');
}

// ---------- JWT FETCH INTERCEPTOR (AUTO-REFRESH ON 401) ----------
async function fetchWithAuth(url, options = {}) {
    if (!authTokens.access) {
        logoutUI();
        throw new Error('No access token found. Please login.');
    }

    options.headers = {
        ...defaultHeaders,
        ...options.headers,
        'Authorization': `Bearer ${authTokens.access}`
    };

    let response = await fetch(url, options);

    if (response.status === 401 && authTokens.refresh) {
        console.warn('Access token expired. Attempting refresh...');
        const refreshed = await refreshAccessToken();
        
        if (refreshed) {
            options.headers['Authorization'] = `Bearer ${authTokens.access}`;
            response = await fetch(url, options);
        } else {
            logoutUI();
            throw new Error('Session expired. Please login again.');
        }
    }

    return response;
}

async function refreshAccessToken() {
    try {
        const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
            method: 'POST',
            headers: defaultHeaders,
            body: JSON.stringify({ refresh: authTokens.refresh })
        });

        const data = await response.json();
        if (response.ok && data.access) {
            authTokens.access = data.access;
            if (data.refresh) authTokens.refresh = data.refresh;
            localStorage.setItem('portfolio_tokens', JSON.stringify(authTokens));
            return true;
        }
    } catch (err) {
        console.error('Failed to refresh token:', err);
    }
    return false;
}

// ---------- AUTHENTICATION FLOWS ----------

async function handleRegister(event) {
    event.preventDefault();
    hideAlert();

    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;

    if (password !== confirm) {
        showAlert('Passwords do not match!', 'error');
        return;
    }

    const data = {
        first_name: document.getElementById('regFirstName').value,
        last_name: document.getElementById('regLastName').value,
        username: document.getElementById('regUsername').value,
        email: document.getElementById('regEmail').value,
        password: password,
        confirm_password: confirm
    };

    showLoader('Creating account...');

    try {
        const response = await fetch(`${API_BASE_URL}/signup/`, {
            method: 'POST',
            headers: defaultHeaders,
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            showAlert('Registration successful! Please check your email for OTP.', 'success');
            document.getElementById('otpSection').classList.add('show');
            document.getElementById('otpSection').dataset.email = data.email;
        } else {
            const errors = Object.values(result.errors || {}).flat().join(' ');
            showAlert(errors || 'Registration failed. Please try again.', 'error');
        }
    } catch (err) {
        showAlert('Could not connect to server.', 'error');
        console.error(err);
    } finally {
        hideLoader();
    }
}

async function handleLogin(event) {
    event.preventDefault();
    hideAlert();

    const data = {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
    };

    showLoader('Logging in...');

    try {
        const response = await fetch(`${API_BASE_URL}/login/`, {
            method: 'POST',
            headers: defaultHeaders,
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            authTokens.access = result.access_token;
            authTokens.refresh = result.refresh_token;
            currentUser = result.user;
            
            showAlert('Login successful!', 'success');
            setTimeout(() => showApp(), 500);
        } else {
            showAlert(result.errors || 'Invalid credentials.', 'error');
        }
    } catch (err) {
        showAlert('Could not connect to server.', 'error');
        console.error(err);
    } finally {
        hideLoader();
    }
}

async function handleVerifyOTP(event) {
    event.preventDefault();
    hideAlert();

    const email = document.getElementById('otpSection').dataset.email;
    const otp = document.getElementById('otpInput').value;

    if (!email) {
        showAlert('Email not found. Please register again.', 'error');
        return;
    }

    showLoader('Verifying OTP...');

    try {
        const response = await fetch(`${API_BASE_URL}/verify-otp/`, {
            method: 'POST',
            headers: defaultHeaders,
            body: JSON.stringify({ email, otp })
        });

        const result = await response.json();

        if (result.success) {
            showAlert('Email verified successfully! Please login.', 'success');
            document.getElementById('otpSection').classList.remove('show');
            document.getElementById('otpInput').value = '';
            switchAuthTab('login');
        } else {
            showAlert(result.errors?.otp || 'Invalid OTP. Please try again.', 'error');
        }
    } catch (err) {
        showAlert('Could not verify OTP.', 'error');
        console.error(err);
    } finally {
        hideLoader();
    }
}

async function handleResendOTP() {
    hideAlert();
    const email = document.getElementById('otpSection').dataset.email;

    if (!email) {
        showAlert('Email not found.', 'error');
        return;
    }

    showLoader('Resending OTP...');

    try {
        const response = await fetch(`${API_BASE_URL}/resend-otp/`, {
            method: 'POST',
            headers: defaultHeaders,
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (result.success) {
            showAlert('New OTP sent to your email!', 'success');
        } else {
            showAlert(result.errors?.email || 'Failed to resend OTP.', 'error');
        }
    } catch (err) {
        showAlert('Could not resend OTP.', 'error');
        console.error(err);
    } finally {
        hideLoader();
    }
}

// ---------- GOOGLE AUTHENTICATION ----------
const CLIENT_ID = "608144473264-j69v4lst02gks2v2ua9c9l4vr9e9m6d7.apps.googleusercontent.com";

function initGoogleSignIn() {
    if (typeof google === 'undefined' || !google.accounts) {
        setTimeout(initGoogleSignIn, 100);
        return;
    }

    google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleGoogleResponse
    });

    ['googleLoginBtn', 'googleRegisterBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => google.accounts.id.prompt());
        }
    });
}

window.addEventListener('load', initGoogleSignIn);

async function handleGoogleResponse(response) {
    showLoader('Signing in with Google...');
    try {
        const res = await fetch(`${API_BASE_URL}/google-auth/`, {
            method: 'POST',
            headers: defaultHeaders,
            body: JSON.stringify({ token: response.credential })
        });

        const data = await res.json();

        if (data.success) {
            authTokens.access = data.access_token || data.data?.access_token;
            authTokens.refresh = data.refresh_token || data.data?.refresh_token;
            currentUser = data.user || data.data?.user;

            showAlert('Google login successful!', 'success');
            setTimeout(() => showApp(), 500);
        } else {
            showAlert(data.errors || data.message || 'Google authentication failed.', 'error');
        }
    } catch (error) {
        console.error(error);
        showAlert('Could not connect to server.', 'error');
    } finally {
        hideLoader();
    }
}

// ---------- LOGOUT & SESSION CONTROL ----------

async function handleLogout() {
    if (!authTokens.refresh) {
        logoutUI();
        return;
    }

    showLoader('Logging out...');

    try {
        await fetch(`${API_BASE_URL}/logout/`, {
            method: 'POST',
            headers: {
                ...defaultHeaders,
                'Authorization': `Bearer ${authTokens.access}`
            },
            body: JSON.stringify({ refresh_token: authTokens.refresh })
        });
    } catch (err) {
        console.error('Logout error:', err);
    } finally {
        logoutUI();
        hideLoader();
    }
}

function logoutUI() {
    authTokens = { access: null, refresh: null };
    currentUser = null;
    localStorage.removeItem('portfolio_tokens');
    localStorage.removeItem('portfolio_user');
    
    document.getElementById('profileSection').classList.remove('show');
    document.getElementById('appContainer').classList.remove('show');
    document.getElementById('authContainer').style.display = 'block';
    
    navigateToStep(1);
}

function showApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('profileSection').classList.add('show');
    document.getElementById('appContainer').classList.add('show');
    
    if (currentUser) {
        document.getElementById('profileAvatar').textContent = 
            (currentUser.first_name?.[0] || '') + (currentUser.last_name?.[0] || 'U');
        document.getElementById('profileName').textContent = 
            `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.username;
        document.getElementById('profileEmail').textContent = currentUser.email || '';
        document.getElementById('profileBadge').textContent = 
            currentUser.is_verified ? '✅ Verified' : '⚠️ Not Verified';
        document.getElementById('profileBadge').className = 
            `badge ${currentUser.is_verified ? 'badge-success' : ''}`;
    }
    
    if (authTokens.access) {
        localStorage.setItem('portfolio_tokens', JSON.stringify(authTokens));
    }
    if (currentUser) {
        localStorage.setItem('portfolio_user', JSON.stringify(currentUser));
    }
}

// ============ PORTFOLIO GENERATOR ENGINE ============

function navigateToStep(step) {
    document.getElementById(`step${currentStep}`).classList.remove('active');
    document.getElementById(`step${step}`).classList.add('active');
    
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`dot${i}`);
        if (dot) {
            dot.classList.remove('active', 'completed');
            if (i < step) dot.classList.add('completed');
            if (i === step) dot.classList.add('active');
        }
    }
    
    currentStep = step;
}

// ---------- DYNAMIC FORM BUILDERS ----------

function addProjectField() {
    const container = document.getElementById('projects_container');
    const div = document.createElement('div');
    div.className = 'dynamic-item project-item';
    div.style.marginBottom = '1rem';
    div.innerHTML = `
        <input type="text" class="proj_title" placeholder="Project Title" style="margin-bottom:0.5rem;">
        <textarea class="proj_desc" rows="2" placeholder="Project Description" style="margin-bottom:0.5rem;"></textarea>
        <input type="text" class="proj_link" placeholder="Project Link">
    `;
    container.appendChild(div);
}

function addExperienceField() {
    const container = document.getElementById('experience_container');
    const div = document.createElement('div');
    div.className = 'dynamic-item experience-item';
    div.style.marginBottom = '1rem';
    div.innerHTML = `
        <input type="text" class="exp_role" placeholder="Role / Position" style="margin-bottom:0.5rem;">
        <input type="text" class="exp_company" placeholder="Company Name" style="margin-bottom:0.5rem;">
        <input type="text" class="exp_duration" placeholder="Duration (e.g., 2024 - Present)" style="margin-bottom:0.5rem;">
        <textarea class="exp_desc" rows="2" placeholder="Responsibilities & Key Achievements"></textarea>
    `;
    container.appendChild(div);
}

function addEducationField() {
    const container = document.getElementById('education_container');
    const div = document.createElement('div');
    div.className = 'dynamic-item education-item';
    div.style.marginBottom = '1rem';
    div.innerHTML = `
        <input type="text" class="edu_degree" placeholder="Degree / Program" style="margin-bottom:0.5rem;">
        <input type="text" class="edu_institution" placeholder="University / Institution Name" style="margin-bottom:0.5rem;">
        <input type="text" class="edu_year" placeholder="Year / Duration (e.g., 2022 - 2026)">
    `;
    container.appendChild(div);
}

function addCertificationField() {
    const container = document.getElementById('certifications_container');
    const div = document.createElement('div');
    div.className = 'dynamic-item cert-item';
    div.style.marginBottom = '1rem';
    div.innerHTML = `
        <input type="text" class="cert_name" placeholder="Certification Name" style="margin-bottom:0.5rem;">
        <input type="text" class="cert_issuer" placeholder="Issuing Organization" style="margin-bottom:0.5rem;">
        <input type="text" class="cert_year" placeholder="Year Received" style="margin-bottom:0.5rem;">
        <input type="text" class="cert_link" placeholder="Credential Verification URL (Optional)">
    `;
    container.appendChild(div);
}

// ---------- FORM DATA EXTRACTORS ----------

function getProjectsFromForm() {
    const items = document.querySelectorAll('.project-item');
    return Array.from(items).map(item => ({
        title: item.querySelector('.proj_title').value,
        description: item.querySelector('.proj_desc').value,
        link: item.querySelector('.proj_link').value
    })).filter(p => p.title.trim() !== "");
}

function getExperienceFromForm() {
    const items = document.querySelectorAll('.experience-item');
    return Array.from(items).map(item => ({
        role: item.querySelector('.exp_role').value,
        company: item.querySelector('.exp_company').value,
        duration: item.querySelector('.exp_duration').value,
        description: item.querySelector('.exp_desc').value
    })).filter(e => e.role.trim() !== "");
}

function getEducationFromForm() {
    const items = document.querySelectorAll('.education-item');
    return Array.from(items).map(item => ({
        degree: item.querySelector('.edu_degree').value,
        institution: item.querySelector('.edu_institution').value,
        year: item.querySelector('.edu_year').value
    })).filter(e => e.degree.trim() !== "");
}

function getCertificationsFromForm() {
    const items = document.querySelectorAll('.cert-item');
    return Array.from(items).map(item => ({
        name: item.querySelector('.cert_name').value,
        issuer: item.querySelector('.cert_issuer').value,
        year: item.querySelector('.cert_year').value,
        link: item.querySelector('.cert_link').value
    })).filter(c => c.name.trim() !== "");
}

// ---------- PHASE 1: Generate AI Design Template ----------
async function generateAITemplate() {
    const designPayload = {
        style: document.getElementById('style_select').value,
        color_palette: document.getElementById('palette_input').value,
        typography: document.getElementById('font_select').value,
        animation_level: document.getElementById('animation_select').value,
        card_style: "Glassmorphic",
        custom_requirements: document.getElementById('custom_requirements')?.value || ""
    };

    showLoader('Generating AI design template...');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/generate-template/`, {
            method: 'POST',
            body: JSON.stringify(designPayload)
        });

        const data = await response.json();

        if (data.success) {
            generatedTemplateHtml = data.template_html;
            
            if (!generatedTemplateHtml || !generatedTemplateHtml.includes('{{')) {
                throw new Error('Generated template is missing required Jinja2 placeholders');
            }
            
            navigateToStep(2);
            showAlert('Template generated successfully!', 'success');
        } else {
            showAlert(data.error || 'Failed to generate template.', 'error');
        }
    } catch (err) {
        console.error('Template generation error:', err);
        showAlert(err.message || 'Could not connect to server.', 'error');
    } finally {
        hideLoader();
    }
}

// ---------- PHASE 3: Render Portfolio with Local Jinja2 Engine ----------
async function renderFinalPortfolio() {
    if (!generatedTemplateHtml) {
        showAlert('Please generate a design template first.', 'error');
        return;
    }

    const userData = {
        name: document.getElementById('field_name').value || "John Doe",
        title: document.getElementById('field_title').value || "Software Engineer",
        tagline: document.getElementById('field_tagline').value || "Building intelligent web systems.",
        about_me: document.getElementById('field_about').value || "Passionate about software architecture.",
        email: document.getElementById('field_email').value || "john@example.com",
        phone: document.getElementById('field_phone')?.value || "",
        github: document.getElementById('field_github').value || "https://github.com",
        linkedin: document.getElementById('field_linkedin').value || "https://linkedin.com",
        x: document.getElementById('field_x')?.value || "",
        skills: document.getElementById('field_skills').value.split(',').map(s => s.trim()).filter(Boolean),
        projects: getProjectsFromForm(),
        experience: getExperienceFromForm(),
        education: getEducationFromForm(),
        certifications: getCertificationsFromForm()
    };

    showLoader('Rendering portfolio with Jinja2...');

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/render-portfolio/`, {
            method: 'POST',
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
            showAlert('Portfolio rendered successfully!', 'success');
        } else {
            showAlert(data.error || 'Failed to render portfolio.', 'error');
        }
    } catch (err) {
        console.error('Render error:', err);
        showAlert(err.message || 'Could not connect to server.', 'error');
    } finally {
        hideLoader();
    }
}

// ---------- DOWNLOAD PORTFOLIO ----------
function downloadPortfolio() {
    if (!currentRenderedHtml) {
        showAlert('No rendered portfolio available.', 'error');
        return;
    }

    const blob = new Blob([currentRenderedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============ INIT ============

function checkSession() {
    const savedTokens = localStorage.getItem('portfolio_tokens');
    const savedUser = localStorage.getItem('portfolio_user');
    
    if (savedTokens) {
        try {
            authTokens = JSON.parse(savedTokens);
            if (savedUser) currentUser = JSON.parse(savedUser);
            if (authTokens.access) showApp();
        } catch (e) {
            localStorage.removeItem('portfolio_tokens');
            localStorage.removeItem('portfolio_user');
        }
    }
}

// Initialize
checkSession();

// Expose globals for HTML inline events
window.switchAuthTab = switchAuthTab;
window.handleRegister = handleRegister;
window.handleLogin = handleLogin;
window.handleVerifyOTP = handleVerifyOTP;
window.handleResendOTP = handleResendOTP;
window.handleLogout = handleLogout;
window.navigateToStep = navigateToStep;
window.addProjectField = addProjectField;
window.addExperienceField = addExperienceField;
window.addEducationField = addEducationField;
window.addCertificationField = addCertificationField;
window.generateAITemplate = generateAITemplate;
window.renderFinalPortfolio = renderFinalPortfolio;
window.downloadPortfolio = downloadPortfolio;
window.initGoogleSignIn = initGoogleSignIn;