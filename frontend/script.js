 // Cloudflare Worker Endpoint
        const API_ENDPOINT = "https://your-worker-subdomain.workers.dev";

        document.addEventListener('DOMContentLoaded', function() {
            // Dark Mode Toggle
            const darkModeToggle = document.querySelector('.dark-mode-toggle');
            darkModeToggle.addEventListener('click', function() {
                document.body.classList.toggle('dark-mode');
                const icon = darkModeToggle.querySelector('i');
                if (document.body.classList.contains('dark-mode')) {
                    icon.classList.remove('fa-moon');
                    icon.classList.add('fa-sun');
                    localStorage.setItem('darkMode', 'enabled');
                } else {
                    icon.classList.remove('fa-sun');
                    icon.classList.add('fa-moon');
                    localStorage.setItem('darkMode', 'disabled');
                }
            });

            // Check for saved dark mode preference
            if (localStorage.getItem('darkMode') === 'enabled') {
                document.body.classList.add('dark-mode');
                darkModeToggle.querySelector('i').classList.remove('fa-moon');
                darkModeToggle.querySelector('i').classList.add('fa-sun');
            }

            // Tab Switching
            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(tab => {
                tab.addEventListener('click', function() {
                    const tabId = this.getAttribute('data-tab');

                    // Remove active class from all tabs and contents
                    tabs.forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(content => {
                        content.classList.remove('active');
                    });

                    // Add active class to clicked tab and corresponding content
                    this.classList.add('active');
                    document.getElementById(`${tabId}-tab`).classList.add('active');
                });
            });

            // Helper function to show error
            function showError(elementId, message) {
                const errorElement = document.getElementById(elementId);
                errorElement.textContent = message;
                errorElement.style.display = 'block';
                setTimeout(() => {
                    errorElement.style.display = 'none';
                }, 5000);
            }

            // Helper function to toggle spinner
            function toggleSpinner(elementId, show) {
                const spinner = document.getElementById(elementId);
                spinner.style.display = show ? 'block' : 'none';
            }

            // Helper function to toggle button state
            function toggleButton(buttonId, disabled) {
                const button = document.getElementById(buttonId);
                button.disabled = disabled;
            }

            // Helper function to display media results
            function displayMediaResults(containerId, mediaArray, isProfile = false) {
                const container = document.getElementById(containerId);

                if (mediaArray.length === 0) {
                    container.innerHTML = '<p>No media found for this request.</p>';
                    container.style.display = 'block';
                    return;
                }

                let html = '';

                if (isProfile && mediaArray[0].profile) {
                    // Profile header
                    const profile = mediaArray[0].profile;
                    html += `
                        <div class="profile-header">
                            <img src="${profile.avatar}" alt="${profile.username}" class="profile-avatar">
                            <div class="profile-info">
                                <h3>${profile.full_name}</h3>
                                <p>@${profile.username}</p>
                                <div class="profile-stats">
                                    <div class="stat">
                                        <div class="stat-value">${profile.posts_count}</div>
                                        <div class="stat-label">Posts</div>
                                    </div>
                                    <div class="stat">
                                        <div class="stat-value">${profile.followers}</div>
                                        <div class="stat-label">Followers</div>
                                    </div>
                                    <div class="stat">
                                        <div class="stat-value">${profile.following}</div>
                                        <div class="stat-label">Following</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }

                html += '<div class="media-grid">';

                mediaArray.forEach((media, index) => {
                    if (media.type === 'image') {
                        html += `
                            <div class="media-item">
                                <img src="${media.url}" alt="Instagram Media ${index + 1}">
                                <a href="${media.url}" download="instagram_${Date.now()}_${index}.jpg" class="download-btn">
                                    <i class="fas fa-download"></i>
                                </a>
                            </div>
                        `;
                    } else if (media.type === 'video') {
                        html += `
                            <div class="media-item">
                                <video controls>
                                    <source src="${media.url}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                                <a href="${media.url}" download="instagram_${Date.now()}_${index}.mp4" class="download-btn">
                                    <i class="fas fa-download"></i>
                                </a>
                            </div>
                        `;
                    }
                });

                html += '</div>';
                container.innerHTML = html;
                container.style.display = 'block';
            }

            // Download Post
            document.getElementById('download-post-btn').addEventListener('click', async function() {
                const url = document.getElementById('post-url').value.trim();
                const errorElement = 'post-error';
                const spinnerElement = 'post-spinner';
                const resultElement = 'post-result';
                const buttonId = 'download-post-btn';

                if (!url) {
                    showError(errorElement, 'Please enter a valid Instagram URL');
                    return;
                }

                if (!url.includes('instagram.com/p/') && !url.includes('instagram.com/reel/')) {
                    showError(errorElement, 'Invalid Instagram post URL. Please use a post or reel URL.');
                    return;
                }

                toggleSpinner(spinnerElement, true);
                toggleButton(buttonId, true);
                document.getElementById(resultElement).style.display = 'none';

                try {
                    const response = await fetch(`${API_ENDPOINT}/post`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ url })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.message || 'Failed to fetch post');
                    }

                    displayMediaResults(resultElement, data.media);
                } catch (error) {
                    showError(errorElement, error.message);
                } finally {
                    toggleSpinner(spinnerElement, false);
                    toggleButton(buttonId, false);
                }
            });

            // Download Profile
            document.getElementById('download-profile-btn').addEventListener('click', async function() {
                const username = document.getElementById('profile-username').value.trim();
                const errorElement = 'profile-error';
                const spinnerElement = 'profile-spinner';
                const resultElement = 'profile-result';
                const buttonId = 'download-profile-btn';

                if (!username) {
                    showError(errorElement, 'Please enter an Instagram username');
                    return;
                }

                toggleSpinner(spinnerElement, true);
                toggleButton(buttonId, true);
                document.getElementById(resultElement).style.display = 'none';

                try {
                    const response = await fetch(`${API_ENDPOINT}/profile`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.message || 'Failed to fetch profile');
                    }

                    displayMediaResults(resultElement, data.media, true);
                } catch (error) {
                    showError(errorElement, error.message);
                } finally {
                    toggleSpinner(spinnerElement, false);
                    toggleButton(buttonId, false);
                }
            });

            // Download Stories
            document.getElementById('download-story-btn').addEventListener('click', async function() {
                const username = document.getElementById('story-username').value.trim();
                const errorElement = 'story-error';
                const spinnerElement = 'story-spinner';
                const resultElement = 'story-result';
                const buttonId = 'download-story-btn';

                if (!username) {
                    showError(errorElement, 'Please enter an Instagram username');
                    return;
                }

                toggleSpinner(spinnerElement, true);
                toggleButton(buttonId, true);
                document.getElementById(resultElement).style.display = 'none';

                try {
                    const response = await fetch(`${API_ENDPOINT}/stories`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.message || 'Failed to fetch stories');
                    }

                    displayMediaResults(resultElement, data.media);
                } catch (error) {
                    showError(errorElement, error.message);
                } finally {
                    toggleSpinner(spinnerElement, false);
                    toggleButton(buttonId, false);
                }
            });

            // Download Reel
            document.getElementById('download-reel-btn').addEventListener('click', async function() {
                const url = document.getElementById('reel-url').value.trim();
                const errorElement = 'reel-error';
                const spinnerElement = 'reel-spinner';
                const resultElement = 'reel-result';
                const buttonId = 'download-reel-btn';

                if (!url) {
                    showError(errorElement, 'Please enter a valid Instagram URL');
                    return;
                }

                if (!url.includes('instagram.com/reel/')) {
                    showError(errorElement, 'Invalid Instagram reel URL');
                    return;
                }

                toggleSpinner(spinnerElement, true);
                toggleButton(buttonId, true);
                document.getElementById(resultElement).style.display = 'none';

                try {
                    const response = await fetch(`${API_ENDPOINT}/reel`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ url })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.message || 'Failed to fetch reel');
                    }

                    displayMediaResults(resultElement, data.media);
                } catch (error) {
                    showError(errorElement, error.message);
                } finally {
                    toggleSpinner(spinnerElement, false);
                    toggleButton(buttonId, false);
                }
            });
        });