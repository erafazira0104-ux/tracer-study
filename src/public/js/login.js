// Ganti tab Admin/Alumni
function switchTab(tab) {
    const adminTab  = document.getElementById('adminTab');
    const alumniTab = document.getElementById('alumniTab');
    const userTypeInput = document.getElementById('userType');
    const btnLogin  = document.querySelector('.btn-login');
    const formTitle = document.getElementById('formTitle');

    if (tab === 'admin') {
        adminTab.classList.add('active');
        alumniTab.classList.remove('active');
        userTypeInput.value = 'admin';
        btnLogin.textContent = 'Masuk Sebagai Admin';
        if (formTitle) formTitle.textContent = 'Masuk Sebagai Admin';
    } else {
        alumniTab.classList.add('active');
        adminTab.classList.remove('active');
        userTypeInput.value = 'alumni';
        btnLogin.textContent = 'Masuk Sebagai Alumni';
        if (formTitle) formTitle.textContent = 'Masuk Sebagai Alumni';
    }
}

// Toggle password visibility
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleIcon    = document.querySelector('.toggle-password i');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (toggleIcon) { toggleIcon.classList.remove('fa-eye'); toggleIcon.classList.add('fa-eye-slash'); }
    } else {
        passwordInput.type = 'password';
        if (toggleIcon) { toggleIcon.classList.remove('fa-eye-slash'); toggleIcon.classList.add('fa-eye'); }
    }
}

// Handle form submission — arahkan ke route yang sesuai
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const username  = document.getElementById('username').value.trim();
        const password  = document.getElementById('password').value.trim();
        const userType  = document.getElementById('userType').value;
        const btnLogin  = document.querySelector('.btn-login');

        // Validasi dasar
        if (!username || !password) {
            showError('Username dan password tidak boleh kosong.');
            return;
        }

        btnLogin.disabled    = true;
        btnLogin.textContent = 'Memproses...';

        // Submit ke route yang sesuai berdasarkan userType
        const action = userType === 'admin' ? '/admin/login' : '/login';

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = action;

        const fields = { username, password, userType };
        Object.entries(fields).forEach(([name, value]) => {
            const input = document.createElement('input');
            input.type  = 'hidden';
            input.name  = name;
            input.value = value;
            form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
    });
}

function showError(msg) {
    const existing = document.querySelector('.js-error');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'js-error error-message';
    div.style.cssText = 'color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:.75rem 1rem;border-radius:.5rem;margin:1rem 0;font-size:.875rem;';
    div.textContent = msg;
    const form = document.getElementById('loginForm');
    form.insertBefore(div, form.firstChild);
    setTimeout(() => div.remove(), 4000);
}

// Focus username on load
window.addEventListener('load', function () {
    const usernameInput = document.getElementById('username');
    if (usernameInput) usernameInput.focus();
});