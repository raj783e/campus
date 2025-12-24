import { auth, db, signOut, onAuthStateChanged, doc, getDoc, setDoc, collection, addDoc, query, orderBy, onSnapshot, updateDoc, arrayUnion, where, getDocs, storage, ref, uploadBytes, getDownloadURL, deleteDoc } from './firebase_config.js';

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

    // Global Message Notifications
    const qChats = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid));
    onSnapshot(qChats, (snapshot) => {
        let hasUnread = false;
        snapshot.docChanges().forEach((change) => {
            if (change.type === "modified" || change.type === "added") {
                const data = change.doc.data();
                // If the last message was NOT sent by me, and it's recent (logic simplified for now)
                // In a real app, we'd check a 'read' timestamp.
                // Here, we just check if it's not me.
                if (data.lastSenderId && data.lastSenderId !== currentUser.uid) {
                    // Check if we are currently viewing this chat
                    if (activeChatId !== change.doc.id) {
                        hasUnread = true;
                        showToast(`New message from ${data.participantNames.find(n => n !== currentUser.name)}`, "info");
                    }
                }
            }
        });

        const dot = document.getElementById('msgNotificationDot');
        if (dot) {
            if (hasUnread) {
                dot.classList.add('active');
            }
            // Note: We don't auto-remove it here, we remove it when they click 'Messages'
        }
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

// Chat Elements (Legacy - Removed)
// const chatBox = document.getElementById('chatBox');
// const chatContactName = document.getElementById('chatContactName');
// const chatMessages = document.getElementById('chatMessages');
// const chatInput = document.getElementById('chatInput');
// const sendMessageBtn = document.getElementById('sendMessageBtn');
const completeProfileModal = document.getElementById('completeProfileModal');
const completeProfileForm = document.getElementById('completeProfileForm');
const inquiriesModal = document.getElementById('inquiriesModal');
const inquiriesList = document.getElementById('inquiriesList');

let activeChatId = null;
let chatUnsubscribe = null;
let conversationUnsubscribe = null;

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
    if (postTypeSelect) {
        postTypeSelect.value = 'notice'; // Reset to default
        postTypeSelect.dispatchEvent(new Event('change'));
    }
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
const subjectGroup = document.getElementById('subjectGroup');

if (postTypeSelect) {
    postTypeSelect.addEventListener('change', () => {
        const type = postTypeSelect.value;
        postFileInput.value = ''; // Clear previous selection

        // Reset all to default hidden/shown state
        lostFoundTypeGroup.style.display = 'none';
        dateGroup.style.display = 'none';
        locationGroup.style.display = 'none';
        fileUploadGroup.style.display = 'none';
        subjectGroup.style.display = 'none';

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
            dateGroup.style.display = 'block';
            locationLabel.textContent = 'Location Name';
            descLabel.textContent = 'Details';
            fileUploadGroup.style.display = 'block';
            fileLabel.textContent = 'Picture';
            postFileInput.accept = 'image/*';
        } else if (type === 'material') {
            titleLabel.textContent = 'Title Name';
            descLabel.textContent = 'Action / Description';
            fileUploadGroup.style.display = 'block';
            subjectGroup.style.display = 'block';
            fileLabel.textContent = 'Upload Document';
            postFileInput.accept = '.pdf,.doc,.docx,.txt';
        }
    });
}

createForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
        showToast("You must be logged in to post.", "error");
        return;
    }

    const type = document.getElementById('postType').value;
    const title = document.getElementById('postTitle').value;
    const description = document.getElementById('postDescription').value;
    const file = postFileInput.files[0];

    // New Fields
    const eventDate = document.getElementById('postDate').value;
    const location = document.getElementById('postLocation').value;
    const lostType = document.getElementById('lostFoundType').value;
    const subject = document.getElementById('postSubject').value;

    const date = new Date().toISOString().split('T')[0];

    // File Validation
    if (file && file.size > 5 * 1024 * 1024) { // 5MB limit
        showToast("File is too large. Max size is 5MB.", "error");
        return;
    }

    console.log(`Creating post of type: ${type}`);

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
            if (file) {
                showToast("Uploading image...", "info");
                try {
                    // Import uploadBytesResumable dynamically if needed, or assume it's available from the module
                    // Since we didn't import it, let's stick to uploadBytes but with better error logging
                    // Wait, I should add uploadBytesResumable to imports first if I want to use it.
                    // For now, I'll stick to uploadBytes but ensure the path is clean.

                    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                    const storageRef = ref(storage, `lost_found/${currentUser.uid}/${Date.now()}_${cleanFileName}`);

                    console.log("Starting upload to:", storageRef.fullPath);
                    const snapshot = await uploadBytes(storageRef, file);
                    console.log("Upload successful:", snapshot);
                    imageUrl = await getDownloadURL(storageRef);
                } catch (uploadError) {
                    console.error("Image upload failed:", uploadError);
                    showToast("Image upload failed: " + uploadError.message, "error");
                    return;
                }
            }

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
            if (file) {
                showToast("Uploading file...", "info");
                try {
                    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                    const storageRef = ref(storage, `materials/${currentUser.uid}/${Date.now()}_${cleanFileName}`);

                    console.log("Starting upload to:", storageRef.fullPath);
                    const snapshot = await uploadBytes(storageRef, file);
                    console.log("Upload successful:", snapshot);
                    fileUrl = await getDownloadURL(storageRef);
                } catch (uploadError) {
                    console.error("File upload failed:", uploadError);
                    showToast("File upload failed: " + uploadError.message, "error");
                    return;
                }
            }

            await addDoc(collection(db, "materials"), {
                subject: subject || "General",
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
        showToast("Error creating post: " + error.message, "error");
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
        const storageRef = ref(storage, `profile_photos/${currentUser.uid}/${file.name}`);
        await uploadBytes(storageRef, file);
        photoUrl = await getDownloadURL(storageRef);
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
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    const sidebarName = document.getElementById('sidebarName');
    const sidebarId = document.getElementById('sidebarId');

    if (sidebarAvatar && sidebarName) {
        const avatarContent = currentUser.photo ?
            `<img src="${currentUser.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` :
            getInitials(currentUser.name);

        sidebarAvatar.innerHTML = avatarContent;
        sidebarName.textContent = currentUser.name;
        if (sidebarId) sidebarId.textContent = `ID: ${currentUser.id || 'N/A'}`;
    }
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

// Chat Logic
// Chat Logic (Legacy - Removed)
// sendMessageBtn.addEventListener('click', sendChatMessage);
// chatInput.addEventListener('keypress', (e) => {
//     if (e.key === 'Enter') sendChatMessage();
// });

// Legacy sendChatMessage (Removed)

// Open Chat (Redirects to Messages View)
window.openChat = async (ownerName, ownerId, itemId) => {
    if (!currentUser) {
        showToast("You must be logged in to chat.", "error");
        return;
    }

    try {
        // Check if chat already exists
        const q = query(
            collection(db, "chats"),
            where("itemId", "==", itemId),
            where("participants", "array-contains", currentUser.uid)
        );

        const snapshot = await getDocs(q);
        let chatDocId = null;

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

        activeChatId = chatDocId;

        // Switch to Messages View
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector('[data-view="messages"]').classList.add('active');
        renderView('messages');

    } catch (error) {
        console.error("Error in openChat:", error);
        showToast("Error opening chat: " + error.message, "error");
    }
};

// Load Chat Interface
// Legacy Chat Functions (Removed)
// function loadChat(chatId, title) { ... }
// function addMessageToChat(text, type) { ... }

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
                activeChatId = doc.id;
                // Switch to Messages View
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                document.querySelector('[data-view="messages"]').classList.add('active');
                renderView('messages');
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
        'messages': 'Messages',
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
        case 'messages': renderChatView(); break;
        case 'profile': renderEditProfile(); break;
        default: renderDashboard();
    }
}

// Wishlist Logic
window.toggleWishlist = async (btn, itemId) => {
    btn.classList.toggle('active');
    const icon = btn.querySelector('i');
    if (btn.classList.contains('active')) {
        icon.classList.remove('far');
        icon.classList.add('fas');
        showToast("Added to wishlist", "success");
        // TODO: Save to Firestore
    } else {
        icon.classList.remove('fas');
        icon.classList.add('far');
        showToast("Removed from wishlist", "info");
        // TODO: Remove from Firestore
    }
};

// Full Page Chat View
async function renderChatView() {
    // Clear notification
    const dot = document.getElementById('msgNotificationDot');
    if (dot) dot.classList.remove('active');

    pageTitle.textContent = 'Messages';
    contentArea.innerHTML = `
        <div class="chat-container">
            <div class="chat-sidebar" id="chatSidebar">
                <h3 style="margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);">Conversations</h3>
                <div id="conversationList">
                    <!-- Conversations loaded here -->
                    <p style="text-align:center; color:var(--text-muted); margin-top:2rem;">Loading...</p>
                </div>
            </div>
            <div class="chat-main" id="chatMain">
                ${activeChatId ? `
                    <div class="chat-main-header" id="chatHeaderName">Loading...</div>
                    <div class="chat-main-messages" id="fullChatMessages"></div>
                    <div class="chat-main-input">
                        <input type="text" id="fullChatInput" class="form-control" placeholder="Type a message...">
                        <button id="fullChatSendBtn" class="btn btn-primary"><i class="fas fa-paper-plane"></i></button>
                    </div>
                ` : `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted);">
                        <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>Select a conversation to start chatting</p>
                    </div>
                `}
            </div>
        </div>
    `;

    if (activeChatId) {
        setupFullChatListeners();
    }

    // Load Conversations (Real-time)
    // Note: We sort client-side to avoid needing a composite index in Firestore for this prototype
    const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUser.uid)
    );

    const listContainer = document.getElementById('conversationList');

    if (conversationUnsubscribe) conversationUnsubscribe();

    conversationUnsubscribe = onSnapshot(q, (snapshot) => {
        listContainer.innerHTML = '';
        if (snapshot.empty) {
            listContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted); margin-top:1rem;">No conversations yet.</p>';
        } else {
            // Client-side sort by startedAt (descending)
            const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            chats.sort((a, b) => {
                const dateA = a.startedAt ? new Date(a.startedAt) : new Date(0);
                const dateB = b.startedAt ? new Date(b.startedAt) : new Date(0);
                return dateB - dateA;
            });

            chats.forEach(data => {
                let otherName = data.participantNames.find(name => name !== currentUser.name);
                if (!otherName) otherName = "Me (Self)";

                const div = document.createElement('div');
                div.className = `conversation-item ${data.id === activeChatId ? 'active' : ''}`;
                div.innerHTML = `
                    <div class="conversation-name">${otherName}</div>
                    <div class="conversation-preview">Click to view chat</div>
                `;
                div.onclick = () => {
                    activeChatId = data.id;
                    renderChatView(); // Re-render to show selected chat
                };
                listContainer.appendChild(div);
            });
        }
    }, (error) => {
        console.error("Error loading chats:", error);
        listContainer.innerHTML = '<p style="text-align:center; color:red; margin-top:1rem;">Error loading chats.</p>';
    });
}

function setupFullChatListeners() {
    const input = document.getElementById('fullChatInput');
    const sendBtn = document.getElementById('fullChatSendBtn');
    const messagesDiv = document.getElementById('fullChatMessages');
    const headerName = document.getElementById('chatHeaderName');

    // Get Chat Details for Header
    getDoc(doc(db, "chats", activeChatId)).then(docSnap => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const otherName = data.participantNames.find(name => name !== currentUser.name) || "Chat";
            headerName.textContent = otherName;
        }
    });

    // Send Message Logic
    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;

        try {
            const timestamp = new Date().toISOString();

            // 1. Add message to subcollection
            await addDoc(collection(db, "chats", activeChatId, "messages"), {
                text: text,
                senderId: currentUser.uid,
                senderName: currentUser.name,
                timestamp: timestamp
            });

            // 2. Update parent chat document (for sorting and notifications)
            await updateDoc(doc(db, "chats", activeChatId), {
                lastMessage: text,
                lastMessageTime: timestamp,
                lastSenderId: currentUser.uid,
                startedAt: timestamp // Update startedAt so it bubbles to top
            });

            input.value = '';
        } catch (error) {
            console.error("Error sending message:", error);
            showToast("Error sending message", "error");
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Real-time Messages
    const q = query(collection(db, "chats", activeChatId, "messages"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        messagesDiv.innerHTML = '';
        snapshot.docs.forEach(doc => {
            const msg = doc.data();
            const type = msg.senderId === currentUser.uid ? 'sent' : 'received';

            const msgDiv = document.createElement('div');
            msgDiv.className = `chat-msg ${type}`; // Reuse existing chat-msg styles
            msgDiv.textContent = msg.text;
            messagesDiv.appendChild(msgDiv);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
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

// Wishlist Logic
window.toggleWishlist = async (btn, itemId) => {
    if (!currentUser) {
        showToast("Please log in to use wishlist", "error");
        return;
    }

    btn.classList.toggle('active');
    const icon = btn.querySelector('i');
    const isAdding = btn.classList.contains('active');

    if (isAdding) {
        icon.classList.remove('far');
        icon.classList.add('fas');
        try {
            await setDoc(doc(db, "users", currentUser.uid, "wishlist", itemId), {
                itemId: itemId,
                addedAt: new Date().toISOString()
            });
            showToast("Added to wishlist", "success");
        } catch (error) {
            console.error("Error adding to wishlist:", error);
            showToast("Error adding to wishlist", "error");
            // Revert UI
            btn.classList.remove('active');
            icon.classList.remove('fas');
            icon.classList.add('far');
        }
    } else {
        icon.classList.remove('fas');
        icon.classList.add('far');
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "wishlist", itemId));
            showToast("Removed from wishlist", "info");
        } catch (error) {
            console.error("Error removing from wishlist:", error);
            showToast("Error removing from wishlist", "error");
            // Revert UI
            btn.classList.add('active');
            icon.classList.remove('far');
            icon.classList.add('fas');
        }
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
                        <button class="btn btn-sm btn-outline" onclick="toggleComments('${notice.id}')">
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
                            <button class="btn btn-primary" onclick="postComment('${notice.id}')">Post</button>
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

// Helper to escape strings for inline onclick handlers
// Helper to escape strings for inline onclick handlers
window.safeParam = (str) => {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
};

function renderEvents() {
    console.log("Rendering Events...", events);
    if (!currentUser) {
        contentArea.innerHTML = '<p class="text-center">Please log in to view Events.</p>';
        return;
    }

    try {
        if (!events) {
            contentArea.innerHTML = '<p class="text-center">Loading events...</p>';
            return;
        }

        if (events.length === 0) {
            contentArea.innerHTML = `
                <div class="glass-panel" style="padding: 3rem; text-align: center;">
                    <i class="fas fa-calendar-times" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-muted);">No upcoming events found.</p>
                    <button class="btn btn-primary" onclick="document.getElementById('newPostBtn').click()">Create Event</button>
                </div>
            `;
            return;
        }

        contentArea.innerHTML = `
            <div class="dashboard-grid">
                ${events.map(e => {
            try {
                const isRegistered = e.registeredUsers && Array.isArray(e.registeredUsers) && e.registeredUsers.includes(currentUser.uid);
                return `
                        <div class="glass-panel card">
                            <h3 class="card-title">${e.title || 'Untitled Event'}</h3>
                            <p style="color:var(--secondary-color); font-weight:600; margin-bottom:0.5rem;">
                                <i class="fas fa-calendar"></i> ${e.date || 'Date TBD'}
                            </p>
                            <p style="margin-bottom:0.5rem;"><i class="fas fa-map-marker-alt"></i> ${e.location || 'Location TBD'}</p>
                            
                            <div id="event-desc-${e.id}" style="max-height: 3rem; overflow: hidden; margin-bottom: 0.5rem;">
                                <p>${e.description || 'No description available.'}</p>
                            </div>
                            <button class="btn btn-sm btn-outline" style="margin-bottom: 1rem; align-self: flex-start;" onclick="toggleExpand(this, 'event-desc-${e.id}')">Read More</button>

                            ${isRegistered ?
                        `<button class="btn btn-primary" style="width:100%; margin-top:auto; background: #22c55e; cursor: default;">Registered <i class="fas fa-check"></i></button>` :
                        `<button class="btn btn-outline" style="width:100%; margin-top:auto;" onclick="openRegisterModal('${safeParam(e.title)}', '${e.id}')">Register</button>`
                    }
                        </div>
                    `;
            } catch (err) {
                console.error("Error rendering event item:", e, err);
                return '';
            }
        }).join('')}
            </div>
        `;
    } catch (error) {
        console.error("Error in renderEvents:", error);
        contentArea.innerHTML = `<p class="text-center" style="color:red;">Error loading events: ${error.message}</p>`;
    }
}

function renderLostFound() {
    console.log("Rendering Lost & Found...", lostFound);
    if (!currentUser) {
        contentArea.innerHTML = '<p class="text-center">Please log in to view Lost & Found items.</p>';
        return;
    }

    try {
        if (!lostFound) {
            contentArea.innerHTML = '<p class="text-center">Loading items...</p>';
            return;
        }

        if (lostFound.length === 0) {
            contentArea.innerHTML = `
                <div class="glass-panel" style="padding: 3rem; text-align: center;">
                    <i class="fas fa-search" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-muted);">No lost or found items reported.</p>
                    <button class="btn btn-primary" onclick="document.getElementById('newPostBtn').click()">Report Item</button>
                </div>
            `;
            return;
        }

        contentArea.innerHTML = `
            <div class="dashboard-grid">
                ${lostFound.map(item => {
            try {
                return `
                        <div class="glass-panel card">
                            <div style="display:flex; justify-content:space-between;">
                                <h3 class="card-title">${item.item || 'Unnamed Item'}</h3>
                                <span class="badge" style="background:${item.type === 'Lost' ? '#ef4444' : '#22c55e'}; color:white;">${item.type || 'Unknown'}</span>
                            </div>
                            ${item.image ? `<img src="${item.image}" style="width:100%; height:150px; object-fit:cover; border-radius:8px; margin-top:1rem;">` : ''}
                            <p style="margin-top:1rem;"><strong>Location:</strong> ${item.location || 'Unknown'}</p>
                            <p><strong>Owner:</strong> ${item.owner || 'Unknown'}</p>
                            
                            <div style="display: flex; gap: 1rem; margin-top: 1rem; justify-content: flex-end;">
                                ${item.ownerId !== currentUser.uid ? `
                                    <button class="action-btn wishlist" onclick="toggleWishlist(this, '${item.id}')" title="Add to Wishlist">
                                        <i class="far fa-heart"></i>
                                    </button>
                                    <button class="action-btn message" onclick="openChat('${safeParam(item.owner)}', '${item.ownerId}', '${item.id}')" title="Contact Owner">
                                        <i class="fas fa-envelope"></i>
                                    </button>
                                ` : `
                                    <button class="btn btn-outline btn-sm" onclick="viewInquiries('${item.id}')">View Inquiries</button>
                                `}
                            </div>
                        </div>
                    `;
            } catch (err) {
                console.error("Error rendering item:", item, err);
                return '';
            }
        }).join('')}
            </div>
        `;
    } catch (error) {
        console.error("Error in renderLostFound:", error);
        contentArea.innerHTML = `<p class="text-center" style="color:red;">Error loading content: ${error.message}</p>`;
    }
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

function renderEditProfile() {
    pageTitle.textContent = 'Edit Profile';

    const avatarContent = currentUser.photo ?
        `<img src="${currentUser.photo}" style="width:100%; height:100%; object-fit:cover;">` :
        `<span style="font-size: 2.5rem; color: white; font-weight: bold;">${getInitials(currentUser.name)}</span>`;

    contentArea.innerHTML = `
        <div class="glass-panel" style="max-width: 600px; margin: 0 auto; padding: 2rem;">
            <form id="inlineEditProfileForm">
                <div class="form-group" style="text-align: center; margin-bottom: 2rem;">
                    <div id="inlineProfilePreview"
                        style="width: 100px; height: 100px; border-radius: 50%; background: var(--primary-gradient); margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        ${avatarContent}
                    </div>
                    <label for="inlineProfilePhotoInput" class="btn btn-outline btn-sm" style="cursor: pointer;">Change Photo</label>
                    <input type="file" id="inlineProfilePhotoInput" accept="image/*" style="display: none;">
                </div>
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="inlineEditName" class="form-control" value="${currentUser.name}" required>
                </div>
                <div class="form-group">
                    <label>Student ID</label>
                    <input type="text" id="inlineEditStudentId" class="form-control" value="${currentUser.id}" required>
                </div>
                <div class="form-group">
                    <label>Department</label>
                    <input type="text" id="inlineEditDepartment" class="form-control" value="${currentUser.department}" required>
                </div>
                <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>

            <div style="margin-top: 3rem;">
                <h3 style="margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">My Posts</h3>
                <div id="myPostsList" style="display: flex; flex-direction: column; gap: 1rem;">
                    <p style="text-align: center; color: var(--text-muted);">Loading posts...</p>
                </div>
            </div>
        </div>
    `;

    // Add event listeners for the new inline form
    const inlineForm = document.getElementById('inlineEditProfileForm');
    const inlinePhotoInput = document.getElementById('inlineProfilePhotoInput');
    const inlinePreview = document.getElementById('inlineProfilePreview');

    inlinePhotoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const imageUrl = URL.createObjectURL(file);
            inlinePreview.innerHTML = `<img src="${imageUrl}" style="width:100%; height:100%; object-fit:cover;">`;
        }
    });

    inlineForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newName = document.getElementById('inlineEditName').value;
        const newId = document.getElementById('inlineEditStudentId').value;
        const newDept = document.getElementById('inlineEditDepartment').value;
        const file = inlinePhotoInput.files[0];

        try {
            let photoUrl = currentUser.photo;
            if (file) {
                const storageRef = ref(storage, `profile_photos/${currentUser.uid}/${file.name}`);
                await uploadBytes(storageRef, file);
                photoUrl = await getDownloadURL(storageRef);
            }

            const updatedData = {
                ...currentUser,
                name: newName,
                id: newId,
                department: newDept,
                photo: photoUrl
            };

            await setDoc(doc(db, "users", currentUser.uid), updatedData);
            currentUser = updatedData;

            updateHeaderProfile();
            showToast("Profile updated successfully!", "success");
        } catch (error) {
            console.error("Error updating profile:", error);
            showToast("Error updating profile", "error");
        }
    });

    loadUserPosts();
}

async function loadUserPosts() {
    const list = document.getElementById('myPostsList');
    if (!list) return;

    try {
        const collections = ['notices', 'events', 'lostFound', 'materials'];
        let allPosts = [];

        for (const col of collections) {
            const q = query(collection(db, col), where("authorId", "==", currentUser.uid));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                allPosts.push({
                    id: doc.id,
                    type: col,
                    ...doc.data()
                });
            });
        }

        // Sort by date desc
        allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allPosts.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No posts found.</p>';
            return;
        }

        list.innerHTML = allPosts.map(post => `
            <div class="card" style="padding: 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <span class="badge badge-${post.type === 'lostFound' ? 'warning' : 'primary'}" style="margin-bottom: 0.5rem; display: inline-block; text-transform: capitalize;">
                            ${post.type === 'lostFound' ? (post.typeStatus || 'Lost/Found') : post.type}
                        </span>
                        <h4 style="margin-bottom: 0.5rem; font-size: 1.1rem;">${post.title}</h4>
                        <p style="font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-muted);">${post.date}</p>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="deleteUserPost('${post.type}', '${post.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading posts:", error);
        list.innerHTML = '<p style="text-align: center; color: var(--danger-color);">Error loading posts.</p>';
    }
}

window.deleteUserPost = async (collectionName, docId) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
        await deleteDoc(doc(db, collectionName, docId));
        showToast("Post deleted successfully", "success");
        loadUserPosts(); // Reload list
    } catch (error) {
        console.error("Error deleting post:", error);
        showToast("Error deleting post", "error");
    }
};
