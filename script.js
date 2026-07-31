// ============ CONFIGURATION ============
// Replaced local loopback URL with your live Ngrok HTTPS tunnel
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

// Standard headers required for cross-origin requests through Ngrok
const defaultHeaders = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '69420' // Bypasses Ngrok landing warning page
};

// ============ AUTHENTICATION ============

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');
    
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`${tab}Form`).classList.add('active');
    
    hideAlert();
}

function showAlert(message, type = 'error') {
    const alert = document.getElementById('authAlert');
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
}

function hideAlert() {
    document.getElementById('authAlert').className = 'alert';
}

function showLoader(text = 'Processing...') {
    document.getElementById('loaderText').textContent = text;
    document.getElementById('loader').classList.add('show');
}

function hideLoader() {
    document.getElementById('loader').classList.remove('show');
}

// ---------- Register ----------
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

// ---------- Login ----------
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
            setTimeout(() => {
                showApp();
            }, 500);
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

// ---------- Verify OTP ----------
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

// ---------- Resend OTP ----------
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

// ---------- Google Login ----------
async function handleGoogleLogin() {
    hideAlert();
    showLoader('Connecting to Google...');

    try {
        const clientId = 'YOUR_GOOGLE_CLIENT_ID';
        const googleToken = prompt('Enter Google ID Token (for testing):');
        
        if (!googleToken) {
            hideLoader();
            return;
        }

        const response = await fetch(`${API_BASE_URL}/google-auth/`, {
            method: 'POST',
            headers: defaultHeaders,
            body: JSON.stringify({ token: googleToken })
        });

        const result = await response.json();

        if (result.success) {
            authTokens.access = result.access_token;
            authTokens.refresh = result.refresh_token;
            currentUser = result.user;
            
            showAlert('Google login successful!', 'success');
            setTimeout(() => showApp(), 500);
        } else {
            showAlert(result.message || 'Google authentication failed.', 'error');
        }
    } catch (err) {
        showAlert('Google login failed.', 'error');
        console.error(err);
    } finally {
        hideLoader();
    }
}

// ---------- Logout ----------
async function handleLogout() {
    if (!authTokens.refresh) {
        logoutUI();
        return;
    }

    showLoader('Logging out...');

    try {
        const response = await fetch(`${API_BASE_URL}/logout/`, {
            method: 'POST',
            headers: {
                ...defaultHeaders,
                'Authorization': `Bearer ${authTokens.access}`
            },
            body: JSON.stringify({ refresh_token: authTokens.refresh })
        });

        const result = await response.json();
        
        if (result.success) {
            showAlert('Logged out successfully.', 'success');
        }
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
    
    document.getElementById('profileSection').classList.remove('show');
    document.getElementById('appContainer').classList.remove('show');
    document.getElementById('authContainer').style.display = 'block';
    
    navigateToStep(1);
}

// ---------- Show App After Auth ----------
function showApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('profileSection').classList.add('show');
    document.getElementById('appContainer').classList.add('show');
    
    if (currentUser) {
        document.getElementById('profileAvatar').textContent = 
            (currentUser.first_name?.[0] || '') + (currentUser.last_name?.[0] || '');
        document.getElementById('profileName').textContent = 
            `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.username;
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('profileBadge').textContent = 
            currentUser.is_verified ? '✅ Verified' : '⚠️ Not Verified';
        document.getElementById('profileBadge').className = 
            `badge ${currentUser.is_verified ? 'badge-success' : ''}`;
    }
}

// ============ PORTFOLIO GENERATOR ============

function navigateToStep(step) {
    document.getElementById(`step${currentStep}`).classList.remove('active');
    document.getElementById(`step${step}`).classList.add('active');
    
    for (let i = 1; i <= 4; i++) {
        const dot = document.getElementById(`dot${i}`);
        dot.classList.remove('active', 'completed');
        if (i < step) dot.classList.add('completed');
        if (i === step) dot.classList.add('active');
    }
    
    currentStep = step;
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

function getProjectsFromForm() {
    const projectItems = document.querySelectorAll('.project-item');
    const projects = [];
    projectItems.forEach(item => {
        const title = item.querySelector('.proj_title').value;
        const description = item.querySelector('.proj_desc').value;
        const link = item.querySelector('.proj_link').value;
        if (title.trim()) {
            projects.push({ title, description, link });
        }
    });
    return projects;
}

// ---------- Generate Template ----------
async function generateAITemplate() {
    if (!authTokens.access) {
        showAlert('Please login first!', 'error');
        return;
    }

    const designPayload = {
        style: document.getElementById('style_select').value,
        color_palette: document.getElementById('palette_input').value,
        typography: document.getElementById('font_select').value,
        animation_level: document.getElementById('animation_select').value
    };

    showLoader('Generating AI design template...');

    try {
        const response = await fetch(`${API_BASE_URL}/generate-template/`, {
            method: 'POST',
            headers: {
                ...defaultHeaders,
                'Authorization': `Bearer ${authTokens.access}`
            },
            body: JSON.stringify(designPayload)
        });

        const data = await response.json();

        if (data.success) {
            generatedTemplateHtml = data.template_html;
            navigateToStep(2);
            showAlert('Template generated successfully!', 'success');
        } else {
            showAlert(data.error || 'Failed to generate template.', 'error');
            if (response.status === 401) {
                logoutUI();
            }
        }
    } catch (err) {
        showAlert('Could not connect to server.', 'error');
        console.error(err);
    } finally {
        hideLoader();
    }
}

// ---------- Render Portfolio ----------
async function renderFinalPortfolio() {
    if (!generatedTemplateHtml) {
        showAlert('Please generate a design template first.', 'error');
        return;
    }

    if (!authTokens.access) {
        showAlert('Please login first!', 'error');
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

    showLoader('Rendering portfolio with Jinja2...');

    try {
        const response = await fetch(`${API_BASE_URL}/render-portfolio/`, {
            method: 'POST',
            headers: {
                ...defaultHeaders,
                'Authorization': `Bearer ${authTokens.access}`
            },
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
        showAlert('Could not connect to server.', 'error');
        console.error(err);
    } finally {
        hideLoader();
    }
}

// ---------- Download Portfolio ----------
function downloadPortfolio() {
    if (!currentRenderedHtml) {
        showAlert('No rendered portfolio available.', 'error');
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

// ============ INIT ============

function checkSession() {
    const savedTokens = localStorage.getItem('portfolio_tokens');
    if (savedTokens) {
        try {
            const tokens = JSON.parse(savedTokens);
            authTokens = tokens;
        } catch (e) {
            localStorage.removeItem('portfolio_tokens');
        }
    }
}

function saveTokens() {
    localStorage.setItem('portfolio_tokens', JSON.stringify(authTokens));
}

const originalShowApp = showApp;
showApp = function() {
    if (authTokens.access) {
        saveTokens();
    }
    originalShowApp();
};

const originalLogoutUI = logoutUI;
logoutUI = function() {
    localStorage.removeItem('portfolio_tokens');
    originalLogoutUI();
};

checkSession();