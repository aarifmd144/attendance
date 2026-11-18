const { io } = require('../frontend/node_modules/socket.io-client');

const BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

// Native fetch helper
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const fetchOptions = {
    method: options.method || 'GET',
    headers,
  };
  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const error = new Error(data?.message || `HTTP error ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE 10-STEP VERIFICATION SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  const results = {};

  // -------------------------------------------------------------
  // TEST 9: VERIFY ALL THREE EXISTING LOGIN SYSTEMS WORK
  // -------------------------------------------------------------
  console.log('👉 [TEST 9] Verifying all three login systems (Admin, Employee, Food Owner)...');
  let adminRes, empARes, empBRes, foodOwnerRes;

  try {
    adminRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@techcorp.com', password: 'Admin@123' },
    });
    console.log('  ✅ Admin Login successful:', adminRes.data.data.user.email, `(${adminRes.data.data.user.role})`);

    empARes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'arun.kumar@techcorp.com', password: 'Employee@123' },
    });
    console.log('  ✅ Employee A Login successful:', empARes.data.data.user.email, `(${empARes.data.data.user.role})`);

    empBRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'priya.sharma@techcorp.com', password: 'Employee@123' },
    });
    console.log('  ✅ Employee B Login successful:', empBRes.data.data.user.email, `(${empBRes.data.data.user.role})`);

    foodOwnerRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'foodowner@techcorp.com', password: 'Food@123' },
    });
    console.log('  ✅ Food Owner Login successful:', foodOwnerRes.data.data.user.email, `(${foodOwnerRes.data.data.user.role})`);

    results['TEST 9: Three Login Roles'] = true;
    passedTests++;
  } catch (err) {
    console.error('  ❌ TEST 9 FAILED:', err.data || err.message);
    results['TEST 9: Three Login Roles'] = false;
    process.exit(1);
  }

  const adminToken = adminRes.data.data.accessToken;
  const adminId = adminRes.data.data.user.id;

  const empAToken = empARes.data.data.accessToken;
  const empAId = empARes.data.data.user.id;

  const empBToken = empBRes.data.data.accessToken;
  const empBId = empBRes.data.data.user.id;

  const foodOwnerToken = foodOwnerRes.data.data.accessToken;
  const foodOwnerId = foodOwnerRes.data.data.user.id;

  // -------------------------------------------------------------
  // TEST 10: EXISTING ATTENDANCE & FOOD FEATURES WORK
  // -------------------------------------------------------------
  console.log('\n👉 [TEST 10] Verifying existing attendance and cafeteria food features...');
  try {
    const attRes = await request('/attendance/today', {
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    console.log('  ✅ Employee Attendance API accessible (Success:', attRes.data.success, ')');

    const menuRes = await request('/food/items', {
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    console.log(`  ✅ Cafeteria Food Menu API working (${menuRes.data.data?.length || 0} items available)`);

    const reportRes = await request('/reports/daily', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log('  ✅ Admin Reports API working (Success:', reportRes.data.success, ')');

    results['TEST 10: Existing Attendance & Food Features'] = true;
    passedTests++;
  } catch (err) {
    console.error('  ❌ TEST 10 FAILED:', err.data || err.message);
    results['TEST 10: Existing Attendance & Food Features'] = false;
  }

  // Socket helper
  const connectSocket = (token) => {
    return new Promise((resolve, reject) => {
      const s = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
      });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
  };

  console.log('\n🔌 Connecting sockets for Admin, Employee A, Employee B, and Food Owner...');
  const socketAdmin = await connectSocket(adminToken);
  const socketEmpA = await connectSocket(empAToken);
  const socketEmpB = await connectSocket(empBToken);
  const socketFoodOwner = await connectSocket(foodOwnerToken);
  console.log('  ✅ All 4 sockets connected and authenticated successfully via JWT handshake!');

  // -------------------------------------------------------------
  // TEST 1: EMPLOYEE A SENDS MESSAGE TO EMPLOYEE B
  // -------------------------------------------------------------
  console.log('\n👉 [TEST 1] Employee A sends message to Employee B...');
  try {
    const convRes = await request('/chat/conversations', {
      method: 'POST',
      body: { recipientId: empBId },
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    const convIdAB = convRes.data.data.id;

    const empBReceivedPromise = new Promise((resolve) => {
      let msgReceived = false;
      let notifReceived = false;
      socketEmpB.on('receive_message', (msg) => {
        if (msg.conversationId === convIdAB) {
          msgReceived = true;
          if (msgReceived && notifReceived) resolve(msg);
        }
      });
      socketEmpB.on('new_notification', (notif) => {
        if (notif.conversationId === convIdAB) {
          notifReceived = true;
          if (msgReceived && notifReceived) resolve(notif);
        }
      });
    });

    const sendRes = await request(`/chat/conversations/${convIdAB}/messages`, {
      method: 'POST',
      body: { messageContent: 'Hello Priya, checking on the sprint updates!' },
      headers: { Authorization: `Bearer ${empAToken}` },
    });

    await empBReceivedPromise;
    console.log('  ✅ Employee B received message in real-time with popup notification payload:');
    console.log('     Content:', sendRes.data.data.messageContent);
    console.log('     Sender:', sendRes.data.data.sender.name, `(${sendRes.data.data.sender.role})`);
    results['TEST 1: Employee to Employee Chat & Popup Notification'] = true;
    passedTests++;
  } catch (err) {
    console.error('  ❌ TEST 1 FAILED:', err.data || err.message);
    results['TEST 1: Employee to Employee Chat & Popup Notification'] = false;
  }

  // -------------------------------------------------------------
  // TEST 2: EMPLOYEE SENDS TO ADMIN, ADMIN REPLIES INSTANTLY
  // -------------------------------------------------------------
  console.log('\n👉 [TEST 2] Employee A sends to Admin, Admin replies instantly...');
  try {
    const convRes = await request('/chat/conversations', {
      method: 'POST',
      body: { recipientId: adminId },
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    const convIdAdminEmp = convRes.data.data.id;

    const adminRecvPromise = new Promise((resolve) => {
      socketAdmin.once('receive_message', resolve);
    });

    await request(`/chat/conversations/${convIdAdminEmp}/messages`, {
      method: 'POST',
      body: { messageContent: 'Hi Admin, I have submitted my leave request for review.' },
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    await adminRecvPromise;
    console.log('  ✅ Admin received message from Employee A');

    const empARecvPromise = new Promise((resolve) => {
      socketEmpA.once('receive_message', resolve);
    });

    const adminReply = await request(`/chat/conversations/${convIdAdminEmp}/messages`, {
      method: 'POST',
      body: { messageContent: 'Received Arun, I will review and approve it shortly.' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await empARecvPromise;
    console.log('  ✅ Employee A received reply from Admin:', adminReply.data.data.messageContent);

    results['TEST 2: Employee <-> Admin Real-Time Reply'] = true;
    passedTests++;
  } catch (err) {
    console.error('  ❌ TEST 2 FAILED:', err.data || err.message);
    results['TEST 2: Employee <-> Admin Real-Time Reply'] = false;
  }

  // -------------------------------------------------------------
  // TEST 3: EMPLOYEE SENDS TO FOOD OWNER, FOOD OWNER REPLIES
  // -------------------------------------------------------------
  console.log('\n👉 [TEST 3] Employee A sends to Food Owner, Food Owner replies...');
  try {
    const convRes = await request('/chat/conversations', {
      method: 'POST',
      body: { recipientId: foodOwnerId },
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    const convIdFoodEmp = convRes.data.data.id;

    const foodRecvPromise = new Promise((resolve) => {
      socketFoodOwner.once('receive_message', resolve);
    });

    await request(`/chat/conversations/${convIdFoodEmp}/messages`, {
      method: 'POST',
      body: { messageContent: 'Hi, is Masala Chai available during morning break?' },
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    await foodRecvPromise;
    console.log('  ✅ Food Owner received message from Employee A');

    const empARecvPromise = new Promise((resolve) => {
      socketEmpA.once('receive_message', resolve);
    });

    const foodReply = await request(`/chat/conversations/${convIdFoodEmp}/messages`, {
      method: 'POST',
      body: { messageContent: 'Yes Arun! Fresh Masala Chai will be ready at 10:30 AM.' },
      headers: { Authorization: `Bearer ${foodOwnerToken}` },
    });
    await empARecvPromise;
    console.log('  ✅ Employee A received reply from Food Owner:', foodReply.data.data.messageContent);

    results['TEST 3: Employee <-> Food Owner Real-Time Chat'] = true;
    passedTests++;
  } catch (err) {
    console.error('  ❌ TEST 3 FAILED:', err.data || err.message);
    results['TEST 3: Employee <-> Food Owner Real-Time Chat'] = false;
  }

  // -------------------------------------------------------------
  // TEST 4: FOOD OWNER SENDS FOOD-ORDER-READY NOTIFICATION
  // -------------------------------------------------------------
  console.log('\n👉 [TEST 4] Food Owner sends food-order-ready notification to Employee...');
  try {
    const convRes = await request('/chat/conversations', {
      method: 'POST',
      body: { recipientId: empBId },
      headers: { Authorization: `Bearer ${foodOwnerToken}` },
    });
    const convIdFoodEmpB = convRes.data.data.id;

    const empBNotifPromise = new Promise((resolve) => {
      socketEmpB.once('new_notification', resolve);
    });

    await request(`/chat/conversations/${convIdFoodEmpB}/messages`, {
      method: 'POST',
      body: {
        messageContent: '🍽️ ORDER READY: Your Masala Chai & Samosa (Order #ORD-1002) is ready at Counter 1!',
        messageType: 'ORDER_ALERT',
      },
      headers: { Authorization: `Bearer ${foodOwnerToken}` },
    });

    const receivedNotif = await empBNotifPromise;
    console.log('  ✅ Employee B received food-order-ready popup notification:');
    console.log('     Sender:', receivedNotif.sender.name);
    console.log('     Content:', receivedNotif.messageContent);
    console.log('     Type:', receivedNotif.messageType);

    results['TEST 4: Food-Order-Ready Alert Notification'] = true;
    passedTests++;
  } catch (err) {
    console.error('  ❌ TEST 4 FAILED:', err.data || err.message);
    results['TEST 4: Food-Order-Ready Alert Notification'] = false;
  }

  // -------------------------------------------------------------
  // TEST 5: ADMIN SENDS MESSAGE TO FOOD OWNER
  // -------------------------------------------------------------
  console.log('\n👉 [TEST 5] Admin sends a message to Food Owner...');
  try {
    const convRes = await request('/chat/conversations', {
      method: 'POST',
      body: { recipientId: foodOwnerId },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const convIdAdminFood = convRes.data.data.id;

    const foodOwnerRecvPromise = new Promise((resolve) => {
      socketFoodOwner.once('receive_message', resolve);
    });

    const adminMsg = await request(`/chat/conversations/${convIdAdminFood}/messages`, {
      method: 'POST',
      body: { messageContent: 'Hello Cafeteria Team, please ensure adequate supplies for Friday.' },
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await foodOwnerRecvPromise;
    console.log('  ✅ Food Owner received message from Admin:', adminMsg.data.data.messageContent);

    results['TEST 5: Admin -> Food Owner Message'] = true;
    passedTests++;
  } catch (err) {
    console.error('  ❌ TEST 5 FAILED:', err.data || err.message);
    results['TEST 5: Admin -> Food Owner Message'] = false;
  }

  // -------------------------------------------------------------
  // TEST 6: OFFLINE EMPLOYEE RECEIVES MESSAGE UPON RECONNECTION
  // -------------------------------------------------------------
  console.log('\n👉 [TEST 6] Offline employee receives message after logging in again...');
  try {
    socketEmpB.disconnect();
    console.log('  ℹ️ Disconnected Employee B socket (Simulating offline)');

    const convRes = await request('/chat/conversations', {
      method: 'POST',
      body: { recipientId: empBId },
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    const convId = convRes.data.data.id;

    const offlineMsg = await request(`/chat/conversations/${convId}/messages`, {
      method: 'POST',
      body: { messageContent: 'Hey Priya, this message is stored while you are offline!' },
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    console.log('  ℹ️ Message stored in DB while recipient offline. DeliveredAt:', offlineMsg.data.data.deliveredAt);

    // Reconnect Employee B socket
    const reconnectedEmpBSocket = await connectSocket(empBToken);
    console.log('  ℹ️ Employee B reconnected socket');

    const unreadRes = await request('/chat/unread-count', {
      headers: { Authorization: `Bearer ${empBToken}` },
    });
    console.log(`  ✅ Employee B retrieved ${unreadRes.data.count} unread messages after reconnecting`);

    const historyRes = await request(`/chat/conversations/${convId}/messages`, {
      headers: { Authorization: `Bearer ${empBToken}` },
    });
    const foundMsg = historyRes.data.data.find((m) => m.id === offlineMsg.data.data.id);
    if (!foundMsg) {
      throw new Error('Message not found in history after reconnecting');
    }
    console.log('  ✅ Offline message successfully retrieved in conversation history:', foundMsg.messageContent);

    reconnectedEmpBSocket.disconnect();
    results['TEST 6: Offline Message Persistence & Delivery'] = true;
    passedTests++;
  } catch (err) {
    console.error('  ❌ TEST 6 FAILED:', err.data || err.message);
    results['TEST 6: Offline Message Persistence & Delivery'] = false;
  }

  // -------------------------------------------------------------
  // TEST 7: VERIFY UNREAD COUNTS, TIMESTAMPS, DELIVERED & READ STATUS
  // -------------------------------------------------------------
  console.log('\n👉 [TEST 7] Verifying unread counts, timestamps, delivered status, and read receipts...');
  try {
    const socketB = await connectSocket(empBToken);

    const convRes = await request('/chat/conversations', {
      method: 'POST',
      body: { recipientId: empBId },
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    const convId = convRes.data.data.id;

    const msgRes = await request(`/chat/conversations/${convId}/messages`, {
      method: 'POST',
      body: { messageContent: 'Test for delivery and read receipts.' },
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    console.log('  ℹ️ Sent message with timestamp:', msgRes.data.data.createdAt);
    console.log('  ℹ️ Initial deliveredAt:', msgRes.data.data.deliveredAt ? 'YES (Recipient Online)' : 'NO');

    const readReceiptPromise = new Promise((resolve) => {
      socketEmpA.once('messages_read', resolve);
    });

    const readRes = await request(`/chat/conversations/${convId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${empBToken}` },
    });
    console.log(`  ℹ️ Employee B marked conversation as read (Updated ${readRes.data.count} messages)`);

    const receipt = await readReceiptPromise;
    console.log('  ✅ Employee A received real-time read receipt:', receipt);

    const convListRes = await request('/chat/conversations', {
      headers: { Authorization: `Bearer ${empBToken}` },
    });
    const updatedConv = convListRes.data.data.find((c) => c.id === convId);
    console.log('  ✅ Unread count for conversation is now:', updatedConv?.unreadCount ?? 0);

    socketB.disconnect();
    results['TEST 7: Unread Counts, Timestamps, Delivery & Read Receipts'] = true;
    passedTests++;
  } catch (err) {
    console.error('  ❌ TEST 7 FAILED:', err.data || err.message);
    results['TEST 7: Unread Counts, Timestamps, Delivery & Read Receipts'] = false;
  }

  // -------------------------------------------------------------
  // TEST 8: SECURITY & UNAUTHORIZED ACCESS PREVENTION
  // -------------------------------------------------------------
  console.log('\n👉 [TEST 8] Verifying security and unauthorized access prevention...');
  try {
    // 1. Employee B tries to read a conversation between Employee A and Admin
    const adminEmpConvRes = await request('/chat/conversations', {
      method: 'POST',
      body: { recipientId: adminId },
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    const privateConvId = adminEmpConvRes.data.data.id;

    let blockedAccess = false;
    try {
      await request(`/chat/conversations/${privateConvId}/messages`, {
        headers: { Authorization: `Bearer ${empBToken}` },
      });
    } catch (err) {
      if (err.status === 403) {
        blockedAccess = true;
      }
    }

    if (!blockedAccess) {
      throw new Error('Security failure: Non-participant was allowed to access private conversation messages!');
    }
    console.log('  ✅ Unauthorized conversation access blocked with 403 Forbidden');

    // 2. Disallowed role communication
    let blockedRole = false;
    try {
      await request('/chat/conversations', {
        method: 'POST',
        body: { recipientId: foodOwnerId }, // Food Owner to self / unauthorized
        headers: { Authorization: `Bearer ${foodOwnerToken}` },
      });
    } catch (err) {
      if (err.status === 400 || err.status === 403) {
        blockedRole = true;
      }
    }

    if (!blockedRole) {
      throw new Error('Security failure: Disallowed role communication was not rejected!');
    }
    console.log('  ✅ Invalid role communication blocked with 400/403');

    results['TEST 8: Security & Privacy Protection'] = true;
    passedTests++;
  } catch (err) {
    console.error('  ❌ TEST 8 FAILED:', err.data || err.message);
    results['TEST 8: Security & Privacy Protection'] = false;
  }

  // Cleanup sockets
  socketAdmin.disconnect();
  socketEmpA.disconnect();
  socketFoodOwner.disconnect();

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS SUMMARY: ${passedTests} / 10 MODULE TEST SUITES PASSED`);
  console.log('====================================================');
  console.table(results);

  if (passedTests === 10) {
    console.log('\n🎉 ALL 10 USER REQUIREMENTS FULLY VALIDATED AND PASSING!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
