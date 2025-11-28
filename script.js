import { auth, db, signOut, onAuthStateChanged, doc, getDoc, setDoc, collection, addDoc, query, orderBy, onSnapshot, updateDoc, arrayUnion, where } from './firebase_config.js';

// Current User Data (Mock)
let currentUser = null;

// Mock Data with Enhanced Fields
// Real-time Data Containers
let notices = [];
let events = [];
let lostFound = [];
let materials = [];
let schedule = [
    { day: "Monday", time: "09:00 AM", subject: "Data Structures", room: "CS-101" },
    { day: "Monday", time: "11:00 AM", subject: "Web Development", room: "CS-102" },
    { day: "Tuesday", time: "10:00 AM", subject: "Database Systems", room: "CS-103" },
    { day: "Wednesday", time: "02:00 PM", subject: "Algorithms", room: "CS-101" }
]; // Schedule remains static for now

// Initialize Real-time Listeners
function setupRealtimeListeners() {
    // Notices
    const qNotices = query(collection(db, "notices"), orderBy("date", "desc"));
    onSnapshot(qNotices, (snapshot) => {
        notices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        refreshCurrentView();
    });

    // Events
    const qEvents = query(collection(db, "events"), orderBy("date", "asc"));
    onSnapshot(qEvents, (snapshot) => {
        events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        refreshCurrentView();
    });

    // Lost & Found
    const qLostFound = query(collection(db, "lostFound"), orderBy("date", "desc"));
    onSnapshot(qLostFound, (snapshot) => {
        lostFound = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        refreshCurrentView();
    });

    // Materials
    const qMaterials = query(collection(db, "materials"), orderBy("date", "desc"));
    onSnapshot(qMaterials, (snapshot) => {
        materials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        refreshCurrentView();
    });
}

function refreshCurrentView() {
    const activeLink = document.querySelector('.nav-link.active');
    if (activeLink) {
        const view = activeLink.getAttribute('data-view');
        renderView(view);
    }
}

// DOM Elements
const contentArea = document.getElementById('contentArea');
const pageTitle = document.getElementById('pageTitle');
const navLinks = document.querySelectorAll('.nav-link');
const logoutBtn = document.getElementById('logoutBtn');
const newPostBtn = document.getElementById('newPostBtn');
const modal = document.getElementById('modal');
const createForm = document.getElementById('createForm');

// Registration Modal Elements
const registerModal = document.getElementById('registerModal');
const registerForm = document.getElementById('registerForm');
const registerEventTitle = document.getElementById('registerEventTitle');

// Edit Profile Modal Elements
const editProfileModal = document.getElementById('editProfileModal');
const editProfileForm = document.getElementById('editProfileForm');
const profilePhotoInput = document.getElementById('profilePhotoInput');
const profilePreview = document.getElementById('profilePreview');

// Chat Elements
const chatBox = document.getElementById('chatBox');
const chatContactName = document.getElementById('chatContactName');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const completeProfileModal = document.getElementById('completeProfileModal');
const completeProfileForm = document.getElementById('completeProfileForm');
const inquiriesModal = document.getElementById('inquiriesModal');
const inquiriesList = document.getElementById('inquiriesList');

let activeChatId = null;
let chatUnsubscribe = null;

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                // User has a profile
                currentUser = userSnap.data();
                updateHeaderProfile();
                renderDashboard();
                showToast(`Welcome back, ${currentUser.name.split(' ')[0]}!`, "success");
            } else {
                // No profile, show completion modal
                if (completeProfileModal) completeProfileModal.style.display = 'flex';
            }

            // Setup listeners once logged in
            setupRealtimeListeners();

        } catch (error) {
            console.error("Error fetching user profile:", error);
            showToast("Error loading profile", "error");
        }
    } else {
        // No user is signed in
        window.location.href = 'login.html';
    }
});

// Profile Completion Logic
if (completeProfileForm) {
    completeProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('completeName').value;
        const department = document.getElementById('completeDepartment').value;
        const year = document.getElementById('completeYear').value;
        const user = auth.currentUser;

        if (user) {
            // Generate unique Student ID (Year + Random 4 digits)
            const currentYear = new Date().getFullYear();
            const randomPart = Math.floor(1000 + Math.random() * 9000);
            const studentId = `${currentYear}${randomPart}`;

            const userData = {
                name: name,
                department: department,
                year: year,
                id: studentId,
                photo: user.photoURL || null,
                email: user.email,
                uid: user.uid
            };

            try {
                await setDoc(doc(db, "users", user.uid), userData);
                currentUser = userData;
                completeProfileModal.style.display = 'none';
                updateHeaderProfile();
                renderDashboard();
                showToast("Profile setup complete!", "success");
            } catch (error) {
                console.error("Error saving profile:", error);
                showToast("Error saving profile", "error");
            }
        }
    });
}

// Navigation Logic
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        if (link.id === 'logoutBtn') return;

        e.preventDefault();

        // Update active state
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        // Update view
        const view = link.getAttribute('data-view');
        renderView(view);
    });
});

// Logout Logic
logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Error signing out: ", error);
        // Fallback for demo if firebase fails
        window.location.href = 'login.html';
    }
});

// Modal Logic
newPostBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
    if (e.target === registerModal) registerModal.style.display = 'none';
    if (e.target === editProfileModal) editProfileModal.style.display = 'none';
});

// Dynamic File Input & Form Logic
const postTypeSelect = document.getElementById('postType');
const fileUploadGroup = document.getElementById('fileUploadGroup');
const fileLabel = document.getElementById('fileLabel');
const postFileInput = document.getElementById('postFile');

// New Input Elements
const lostFoundTypeGroup = document.getElementById('lostFoundTypeGroup');
const dateGroup = document.getElementById('dateGroup');
const locationGroup = document.getElementById('locationGroup');
const titleLabel = document.getElementById('titleLabel');
const locationLabel = document.getElementById('locationLabel');
const descLabel = document.getElementById('descLabel');

if (postTypeSelect) {
    postTypeSelect.addEventListener('change', () => {
        const type = postTypeSelect.value;
        postFileInput.value = ''; // Clear previous selection

        // Reset all to default hidden/shown state
        lostFoundTypeGroup.style.display = 'none';
        dateGroup.style.display = 'none';
        locationGroup.style.display = 'none';
        fileUploadGroup.style.display = 'none';

        // Default Labels
        titleLabel.textContent = 'Title';
        descLabel.textContent = 'Description';

        if (type === 'notice') {
            // Default state is fine
        } else if (type === 'event') {
            titleLabel.textContent = 'Topic';
            dateGroup.style.display = 'block';
            locationGroup.style.display = 'block';
            locationLabel.textContent = 'Venue Name';
        } else if (type === 'lost-found') {
            titleLabel.textContent = 'Item Name';
            lostFoundTypeGroup.style.display = 'block';
            locationGroup.style.display = 'block';
            locationLabel.textContent = 'Location Name';
            descLabel.textContent = 'Details';
            fileUploadGroup.style.display = 'block';
            fileLabel.textContent = 'Picture';
            postFileInput.accept = 'image/*';
        } else if (type === 'material') {
            titleLabel.textContent = 'Title Name';
            descLabel.textContent = 'Action / Description';
            fileUploadGroup.style.display = 'block';
            fileLabel.textContent = 'Upload Document';
            postFileInput.accept = '.pdf,.doc,.docx,.txt';
        }
    });
}

createForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = document.getElementById('postType').value;
    const title = document.getElementById('postTitle').value;
    const description = document.getElementById('postDescription').value;
    const file = postFileInput.files[0];

    // New Fields
    const eventDate = document.getElementById('postDate').value;
    const location = document.getElementById('postLocation').value;
    const lostType = document.getElementById('lostFoundType').value;

    const date = new Date().toISOString().split('T')[0];

    try {
        if (type === 'notice') {
            await addDoc(collection(db, "notices"), {
                title,
                date,
                content: description,
                author: currentUser.name,
                authorId: currentUser.uid,
                comments: []
            });
        } else if (type === 'event') {
            if (!eventDate || !location) {
                showToast("Please fill in Date and Venue", "error");
                return;
            }
            await addDoc(collection(db, "events"), {
                title, // Topic
                date: eventDate,
                location, // Venue Name
                description,
                registeredUsers: []
            });
        } else if (type === 'lost-found') {
            let imageUrl = null;
            if (file) imageUrl = URL.createObjectURL(file); // Ideally upload to Storage

            await addDoc(collection(db, "lostFound"), {
                type: lostType, // Lost or Found
                item: title, // Item Name
                location, // Location Name
                contact: currentUser.email,
                owner: currentUser.name,
                ownerId: currentUser.uid,
                image: imageUrl,
                date
            });
        } else if (type === 'material') {
            let fileUrl = "";
            if (file) fileUrl = URL.createObjectURL(file); // Ideally upload to Storage

            await addDoc(collection(db, "materials"), {
                subject: "General",
                title, // Title Name
                author: currentUser.name, // Author Name (Profile Name)
                authorId: currentUser.uid,
                description: description, // Action as description
                fileUrl,
                date
            });
        }

        showToast("Post created successfully!", "success");
        modal.style.display = 'none';
        createForm.reset();
        fileUploadGroup.style.display = 'none';
    } catch (error) {
        console.error("Error creating post:", error);
        showToast("Error creating post", "error");
    }
});

// Toast Notification Logic
window.showToast = (message, type = 'info') => {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';

    toast.innerHTML = `<i class="fas fa-${icon}"></i> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Event Registration Logic
let currentEventId = null;
window.openRegisterModal = (title, id) => {
    currentEventId = id;
    registerEventTitle.textContent = `Registering for: ${title}`;
    registerModal.style.display = 'flex';
};

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentEventId) return;

    try {
        const eventRef = doc(db, "events", currentEventId);
        await updateDoc(eventRef, {
            registeredUsers: arrayUnion(currentUser.uid)
        });

        showToast("Registration Successful!", "success");
        registerModal.style.display = 'none';
        registerForm.reset();
    } catch (error) {
        console.error("Error registering:", error);
        showToast("Error registering", "error");
    }
});

// Edit Profile Logic
window.openEditProfileModal = () => {
    document.getElementById('editName').value = currentUser.name;
    document.getElementById('editStudentId').value = currentUser.id;
    document.getElementById('editDepartment').value = currentUser.department;

    // Reset preview
    if (currentUser.photo) {
        profilePreview.innerHTML = `<img src="${currentUser.photo}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
        profilePreview.innerHTML = `<span style="font-size: 2.5rem; color: white; font-weight: bold;">${getInitials(currentUser.name)}</span>`;
    }

    editProfileModal.style.display = 'flex';
};

profilePhotoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const imageUrl = URL.createObjectURL(file);
        profilePreview.innerHTML = `<img src="${imageUrl}" style="width:100%; height:100%; object-fit:cover;">`;
    }
});

editProfileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newName = document.getElementById('editName').value;
    const newId = document.getElementById('editStudentId').value;
    const newDept = document.getElementById('editDepartment').value;
    const file = profilePhotoInput.files[0];

    let photoUrl = currentUser.photo;
    if (file) {
        photoUrl = URL.createObjectURL(file);
    }

    const updatedData = {
        ...currentUser,
        name: newName,
        id: newId,
        department: newDept,
        photo: photoUrl
    };

    if (auth.currentUser) {
        try {
            await setDoc(doc(db, "users", auth.currentUser.uid), updatedData);
            currentUser = updatedData;

            showToast("Profile updated successfully!", "success");
            editProfileModal.style.display = 'none';

            // Update Header
            updateHeaderProfile();

            // Re-render Profile View
            renderProfile();
        } catch (error) {
            console.error("Error updating profile:", error);
            showToast("Error updating profile", "error");
        }
    }
});

function updateHeaderProfile() {
    const headerProfile = document.querySelector('.user-profile');
    const avatarContent = currentUser.photo ?
        `<img src="${currentUser.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` :
        getInitials(currentUser.name);

    headerProfile.querySelector('.avatar').innerHTML = avatarContent;
    headerProfile.querySelector('span').textContent = currentUser.name;
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

// Chat Logic
sendMessageBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text || !activeChatId) return;

    try {
        await addDoc(collection(db, "chats", activeChatId, "messages"), {
            text: text,
            senderId: currentUser.uid,
            senderName: currentUser.name,
            timestamp: new Date().toISOString()
        });
        chatInput.value = '';
    } catch (error) {
        console.error("Error sending message:", error);
        showToast("Error sending message", "error");
    }
}

// Open Chat (Finder contacting Owner)
window.openChat = async (ownerName, ownerId, itemId) => {
    // Check if chat already exists
    const q = query(
        collection(db, "chats"),
        where("itemId", "==", itemId),
        where("participants", "array-contains", currentUser.uid)
    );

    const snapshot = await getDocs(q);
    let chatDocId = null;

    // Filter for specific pair (since array-contains only checks for one)
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.participants.includes(ownerId)) {
            chatDocId = doc.id;
        }
    });

    if (!chatDocId) {
        // Create new chat
        const newChat = await addDoc(collection(db, "chats"), {
            itemId: itemId,
            participants: [currentUser.uid, ownerId],
            participantNames: [currentUser.name, ownerName],
            startedAt: new Date().toISOString()
        });
        chatDocId = newChat.id;
    }

    loadChat(chatDocId, ownerName);
};

// Load Chat Interface
function loadChat(chatId, title) {
    activeChatId = chatId;
    chatContactName.textContent = title;
    chatMessages.innerHTML = '';
    chatBox.style.display = 'flex';

    // Unsubscribe previous listener
    if (chatUnsubscribe) chatUnsubscribe();

    // Listen for messages
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    chatUnsubscribe = onSnapshot(q, (snapshot) => {
        chatMessages.innerHTML = '';
        snapshot.docs.forEach(doc => {
            const msg = doc.data();
            const type = msg.senderId === currentUser.uid ? 'sent' : 'received';
            addMessageToChat(msg.text, type);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

function addMessageToChat(text, type) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${type}`;
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
}

// View Inquiries (Owner viewing chats)
window.viewInquiries = async (itemId) => {
    const q = query(
        collection(db, "chats"),
        where("itemId", "==", itemId)
    );

    const snapshot = await getDocs(q);
    inquiriesList.innerHTML = '';

    if (snapshot.empty) {
        inquiriesList.innerHTML = '<p>No inquiries yet.</p>';
    } else {
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            // Find the other person's name
            const otherName = data.participantNames.find(name => name !== currentUser.name) || "Unknown";

            const btn = document.createElement('button');
            btn.className = 'btn btn-outline';
            btn.style.textAlign = 'left';
            btn.innerHTML = `<i class="fas fa-user"></i> Chat with ${otherName}`;
            btn.onclick = () => {
                inquiriesModal.style.display = 'none';
                loadChat(doc.id, `Chat with ${otherName}`);
            };
            inquiriesList.appendChild(btn);
        });
    }

    inquiriesModal.style.display = 'flex';
};

// Render Functions
function renderView(view) {
    const titles = {
        'dashboard': 'Dashboard',
        'notices': 'Notices',
        'schedule': 'Class Schedule',
        'events': 'Events',
        'lost-found': 'Lost & Found',
        'study-materials': 'Study Materials',
        'profile': 'My Profile'
    };
    pageTitle.textContent = titles[view] || 'Dashboard';

    switch (view) {
        case 'dashboard': renderDashboard(); break;
        case 'notices': renderNotices(); break;
        case 'schedule': renderSchedule(); break;
        case 'events': renderEvents(); break;
        case 'lost-found': renderLostFound(); break;
        case 'study-materials': renderMaterials(); break;
        case 'profile': renderProfile(); break;
        default: renderDashboard();
    }
}

function renderProfile() {
    // Filter data for current user
    const myNotices = notices.filter(n => n.authorId === currentUser.uid);
    const myLostFound = lostFound.filter(i => i.ownerId === currentUser.uid);
    const myMaterials = materials.filter(m => m.authorId === currentUser.uid);
    const myEvents = events.filter(e => e.registeredUsers && e.registeredUsers.includes(currentUser.uid));

    const avatarContent = currentUser.photo ?
        `<img src="${currentUser.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` :
        getInitials(currentUser.name);

    contentArea.innerHTML = `
        <div class="glass-panel card" style="margin-bottom: 2rem;">
            <div style="display: flex; align-items: center; gap: 2rem; flex-wrap: wrap;">
                <div style="width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); display: flex; justify-content: center; align-items: center; font-size: 2.5rem; font-weight: bold; color: white; overflow:hidden;">
                    ${avatarContent}
                </div>
                <div style="flex: 1;">
                    <h2 style="margin-bottom: 0.5rem;">${currentUser.name}</h2>
                    <p style="margin-bottom: 0.25rem; color: var(--text-color);">${currentUser.department} • ${currentUser.year}</p>
                    <p style="font-size: 0.9rem;">Student ID: ${currentUser.id}</p>
                </div>
                <button class="btn btn-outline" onclick="openEditProfileModal()">
                    <i class="fas fa-edit"></i> Edit Profile
                </button>
            </div>
        </div>

        <h3 style="margin-bottom: 1rem;">My Registered Events</h3>
        <div class="dashboard-grid" style="margin-bottom: 2rem;">
            ${myEvents.length > 0 ? myEvents.map(e => `
                <div class="glass-panel card">
                    <h3 class="card-title">${e.title}</h3>
                    <p style="color:var(--secondary-color); font-weight:600; margin-bottom:0.5rem;">
                        <i class="fas fa-calendar"></i> ${e.date}
                    </p>
                    <span class="badge badge-new" style="background: #22c55e; color: white;">Registered</span>
                </div>
            `).join('') : '<p>No registered events yet.</p>'}
        </div>

        <h3 style="margin-bottom: 1rem;">My Posts</h3>
        <div class="glass-panel" style="padding: 1.5rem;">
            ${[...myNotices, ...myLostFound, ...myMaterials].length > 0 ?
            [...myNotices, ...myLostFound, ...myMaterials].map(item => `
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between;">
                            <strong>${item.title || item.item}</strong>
                            <span class="badge" style="background: rgba(255,255,255,0.1);">${item.type || (item.content ? 'Notice' : 'Material')}</span>
                        </div>
                    </div>
                `).join('')
            : '<p>No posts yet.</p>'}
        </div>
    `;
}

function renderDashboard() {
    contentArea.innerHTML = `
        <div class="glass-panel card" style="margin-bottom: 2rem; background: linear-gradient(135deg, rgba(108, 99, 255, 0.1), rgba(255, 101, 132, 0.1));">
            <h2 style="margin-bottom: 0.5rem;">Welcome back, ${currentUser.name.split(' ')[0]}! 👋</h2>
            <p style="color: var(--text-muted);">Here's what's happening on campus today.</p>
            <div style="display: flex; gap: 2rem; margin-top: 1.5rem;">
                <div>
                    <h3 style="margin:0; font-size: 1.5rem; color: var(--primary-color);">${notices.length}</h3>
                    <small>New Notices</small>
                </div>
                <div>
                    <h3 style="margin:0; font-size: 1.5rem; color: var(--secondary-color);">${events.length}</h3>
                    <small>Upcoming Events</small>
                </div>
                <div>
                    <h3 style="margin:0; font-size: 1.5rem; color: var(--accent-color);">${lostFound.filter(i => i.type === 'Lost').length}</h3>
                    <small>Lost Items</small>
                </div>
            </div>
        </div>

        <div class="dashboard-grid">
            <div class="glass-panel card">
                <div class="card-header">
                    <h3 class="card-title">Recent Notices</h3>
                    <span class="badge badge-new">New</span>
                </div>
                <div>
                <div>
                    ${notices.slice(0, 2).map(n => `<p><strong>${n.title}</strong><br><small>${n.date}</small></p>`).join('')}
                </div>
            </div>
            
            <div class="glass-panel card">
                <div class="card-header">
                    <h3 class="card-title">Upcoming Events</h3>
                </div>
                <div>
                     ${events.slice(0, 2).map(e => `<p><strong>${e.title}</strong><br><small>${e.date}</small></p>`).join('')}
                </div>
            </div>
            
            <div class="glass-panel card">
                <div class="card-header">
                    <h3 class="card-title">Today's Schedule</h3>
                </div>
                <div>
                     ${schedule.slice(0, 2).map(s => `<p><strong>${s.time}</strong>: ${s.subject} (${s.room})</p>`).join('')}
                </div>
            </div>
        </div>
    `;
}

// Helper to toggle comments
window.toggleComments = (id) => {
    const section = document.getElementById(`comments-${id}`);
    if (section.style.display === 'block') {
        section.style.display = 'none';
    } else {
        section.style.display = 'block';
    }
};

// Helper to post comment
window.postComment = async (id) => {
    const input = document.getElementById(`comment-input-${id}`);
    const text = input.value.trim();

    if (text) {
        try {
            const noticeRef = doc(db, "notices", id);
            await updateDoc(noticeRef, {
                comments: arrayUnion({ user: currentUser.name, text: text })
            });
            showToast("Comment posted!", "success");
            input.value = '';
        } catch (error) {
            console.error("Error posting comment:", error);
            showToast("Error posting comment", "error");
        }
    }
};

// Helper to expand content
window.toggleExpand = (btn, contentId) => {
    const content = document.getElementById(contentId);
    if (content.style.maxHeight === 'none') {
        content.style.maxHeight = '3rem'; // collapsed height
        content.style.overflow = 'hidden';
        btn.textContent = 'Read More';
    } else {
        content.style.maxHeight = 'none';
        content.style.overflow = 'visible';
        btn.textContent = 'Show Less';
    }
};

function renderNotices() {
    contentArea.innerHTML = `
        <div class="glass-panel" style="padding: 1.5rem;">
            ${notices.length > 0 ? notices.map(notice => `
                <div class="notice-item">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                        <h3 style="font-size:1.1rem; margin:0;">${notice.title}</h3>
                        <small style="color:var(--text-muted);">${notice.date}</small>
                    </div>
                    
                    <div id="notice-content-${notice.id}" style="max-height: 3rem; overflow: hidden; transition: max-height 0.3s ease;">
                        <p>${notice.content}</p>
                    </div>
                    <button class="btn btn-sm btn-outline" style="margin-bottom: 1rem;" onclick="toggleExpand(this, 'notice-content-${notice.id}')">Read More</button>

                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <small style="color:var(--primary-color);">Posted by: ${notice.author}</small>
                        <button class="btn btn-sm btn-outline" onclick="toggleComments(${notice.id})">
                            <i class="fas fa-comment"></i> Comments
                        </button>
                    </div>

                    <div id="comments-${notice.id}" class="comments-section">
                        <div id="comment-list-${notice.id}">
                            ${notice.comments.map(c => `
                                <div class="comment">
                                    <div class="comment-author">${c.user}</div>
                                    ${c.text}
                                </div>
                            `).join('')}
                        </div>
                        <div class="comment-input-group">
                            <input type="text" id="comment-input-${notice.id}" class="form-control" placeholder="Write a comment...">
                            <button class="btn btn-primary" onclick="postComment(${notice.id})">Post</button>
                        </div>
                    </div>
                </div>
            `).join('') : '<p style="text-align:center; color:var(--text-muted);">No notices posted yet.</p>'}
        </div>
    `;
}

function renderSchedule() {
    contentArea.innerHTML = `
        <div class="glass-panel" style="padding: 1.5rem;">
            <div class="schedule-grid">
                ${schedule.map(s => `
                    <div class="schedule-item">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <h4 style="margin:0; color:var(--text-color);">${s.subject}</h4>
                                <p style="margin:0; font-size:0.9rem;">${s.day}, ${s.time}</p>
                            </div>
                            <div class="badge badge-new" style="background:rgba(255,255,255,0.1); color:white;">
                                ${s.room}
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function renderEvents() {
    contentArea.innerHTML = `
        <div class="dashboard-grid">
            ${events.map(e => {
        const isRegistered = e.registeredUsers && e.registeredUsers.includes(currentUser.uid);
        return `
                <div class="glass-panel card">
                    <h3 class="card-title">${e.title}</h3>
                    <p style="color:var(--secondary-color); font-weight:600; margin-bottom:0.5rem;">
                        <i class="fas fa-calendar"></i> ${e.date}
                    </p>
                    <p style="margin-bottom:0.5rem;"><i class="fas fa-map-marker-alt"></i> ${e.location}</p>
                    
                    <div id="event-desc-${e.id}" style="max-height: 3rem; overflow: hidden; margin-bottom: 0.5rem;">
                        <p>${e.description}</p>
                    </div>
                    <button class="btn btn-sm btn-outline" style="margin-bottom: 1rem; align-self: flex-start;" onclick="toggleExpand(this, 'event-desc-${e.id}')">Read More</button>

                    ${isRegistered ?
                `<button class="btn btn-primary" style="width:100%; margin-top:auto; background: #22c55e; cursor: default;">Registered <i class="fas fa-check"></i></button>` :
                `<button class="btn btn-outline" style="width:100%; margin-top:auto;" onclick="openRegisterModal('${e.title}', '${e.id}')">Register</button>`
            }
                </div>
            `}).join('')}
        </div>
    `;
}

// Helper for Chat
// window.openChat is now defined above with full logic

function renderLostFound() {
    contentArea.innerHTML = `
        <div class="dashboard-grid">
            ${lostFound.map(item => `
                <div class="glass-panel card">
                    <div style="display:flex; justify-content:space-between;">
                        <h3 class="card-title">${item.item}</h3>
                        <span class="badge" style="background:${item.type === 'Lost' ? '#ef4444' : '#22c55e'}; color:white;">${item.type}</span>
                    </div>
                    ${item.image ? `<img src="${item.image}" style="width:100%; height:150px; object-fit:cover; border-radius:8px; margin-top:1rem;">` : ''}
                    <p style="margin-top:1rem;"><strong>Location:</strong> ${item.location}</p>
                    <p><strong>Owner:</strong> ${item.owner}</p>
                    ${item.ownerId === currentUser.uid ?
            `<button class="btn btn-outline" style="width:100%; margin-top:1rem;" onclick="viewInquiries('${item.id}')">View Inquiries</button>` :
            `<button class="btn btn-primary" style="width:100%; margin-top:1rem;" onclick="openChat('${item.owner}', '${item.ownerId}', '${item.id}')">Contact Owner</button>`
        }
                </div>
            `).join('')}
        </div>
    `;
}

// Helper for Download
window.downloadMaterial = (url) => {
    if (!url) {
        showToast("Error: File not found! This might be a fraudulent link.", "error");
    } else {
        if (url.startsWith('blob:')) {
            const a = document.createElement('a');
            a.href = url;
            a.download = "downloaded_file";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast("Download started...", "success");
        } else {
            // Simulate download for mock strings
            showToast(`Starting download for: ${url}`, "success");
        }
    }
};

function renderMaterials() {
    contentArea.innerHTML = `
        <div class="glass-panel" style="padding: 1.5rem;">
            <table style="width:100%; border-collapse:collapse; color:var(--text-color);">
                <thead>
                    <tr style="border-bottom:1px solid var(--border-color); text-align:left;">
                        <th style="padding:1rem;">Subject</th>
                        <th style="padding:1rem;">Title</th>
                        <th style="padding:1rem;">Author</th>
                        <th style="padding:1rem;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${materials.map(m => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                            <td style="padding:1rem;">${m.subject}</td>
                            <td style="padding:1rem;">${m.title}</td>
                            <td style="padding:1rem;">${m.author}</td>
                            <td style="padding:1rem;">
                                <button class="btn btn-outline" style="padding:0.25rem 0.75rem; font-size:0.8rem;" onclick="downloadMaterial('${m.fileUrl}')">Download</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Initial Render
// Initial render handled by Auth State
