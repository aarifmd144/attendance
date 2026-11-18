const { io } = require('../frontend/node_modules/socket.io-client');

const BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

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
  console.log('🧪 TESTING LEAVE & CHAT INTEGRATION REQUIREMENTS');
  console.log('====================================================\n');

  // 1. Authenticate users
  console.log('👉 [1/6] Authenticating users (Admin, Employee, Food Owner)...');
  const adminRes = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@techcorp.com', password: 'Admin@123' },
  });
  const adminToken = adminRes.data.data.accessToken;
  const adminId = adminRes.data.data.user.id;

  const empRes = await request('/auth/login', {
    method: 'POST',
    body: { email: 'arun.kumar@techcorp.com', password: 'Employee@123' },
  });
  const empToken = empRes.data.data.accessToken;
  const empId = empRes.data.data.user.id;

  const empBRes = await request('/auth/login', {
    method: 'POST',
    body: { email: 'priya.sharma@techcorp.com', password: 'Employee@123' },
  });
  const empBToken = empBRes.data.data.accessToken;
  const empBId = empBRes.data.data.user.id;

  const foodOwnerRes = await request('/auth/login', {
    method: 'POST',
    body: { email: 'foodowner@techcorp.com', password: 'Food@123' },
  });
  const foodOwnerToken = foodOwnerRes.data.data.accessToken;
  const foodOwnerId = foodOwnerRes.data.data.user.id;
  console.log('  ✅ Authenticated Admin, Employee Arun, Employee Priya, and Food Owner.');

  // Sockets for real-time verification
  const adminSocket = io(SOCKET_URL, { auth: { token: adminToken }, transports: ['websocket'] });
  const empSocket = io(SOCKET_URL, { auth: { token: empToken }, transports: ['websocket'] });
  const foodOwnerSocket = io(SOCKET_URL, { auth: { token: foodOwnerToken }, transports: ['websocket'] });

  await new Promise(r => setTimeout(r, 1000));
  console.log('  ✅ Sockets connected.');

  // 2. Test Employee Leave Request
  console.log('\n👉 [2/6] Testing Employee Leave Request -> Admin Notification & Chat Details...');
  let adminChatReceivedMsg = null;
  adminSocket.on('receive_message', (msg) => {
    if (msg.messageContent && msg.messageContent.includes('NEW LEAVE REQUEST SUBMITTED')) {
      adminChatReceivedMsg = msg;
    }
  });

  const empLeaveRes = await request('/leave', {
    method: 'POST',
    headers: { Authorization: `Bearer ${empToken}` },
    body: {
      leaveType: 'CASUAL',
      startDate: '2026-12-01',
      endDate: '2026-12-02',
      totalDays: 2,
      reason: 'Attending family celebration and annual function out of town.',
    },
  });

  console.log('  ✅ Employee leave submitted, Leave ID:', empLeaveRes.data.data.id);
  const empLeaveId = empLeaveRes.data.data.id;

  // Verify Admin received in-app notification
  const adminNotifs = await request('/notifications', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const leaveNotif = adminNotifs.data.data.find(n => n.title === 'New Leave Request');
  if (!leaveNotif) throw new Error('Admin did not receive New Leave Request notification');
  console.log('  ✅ Admin received in-app notification:', leaveNotif.message);

  // Verify chat message between Employee and Admin
  await new Promise(r => setTimeout(r, 1200));
  const convRes = await request('/chat/conversations', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const empAdminConv = convRes.data.data.find(c => c.otherUser && c.otherUser.id === empId);
  if (!empAdminConv) throw new Error('Direct conversation between Employee and Admin not found');

  const msgsRes = await request(`/chat/conversations/${empAdminConv.id}/messages`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const foundChatMsg = msgsRes.data.data.find(m => m.messageContent.includes('NEW LEAVE REQUEST SUBMITTED'));
  if (!foundChatMsg) throw new Error('Leave details chat message not found in Admin conversation');
  console.log('  ✅ Leave details posted in chat box between Employee and Admin:');
  console.log('     [Snippet]:', foundChatMsg.messageContent.split('\n')[0], foundChatMsg.messageContent.split('\n')[2]);

  // 3. Test Admin Decision (Approve) -> Automatic message update to employee
  console.log('\n👉 [3/6] Testing Admin Accept Decision -> Automatic message update in chat to Employee...');
  let empReceivedDecisionMsg = null;
  empSocket.on('receive_message', (msg) => {
    if (msg.messageContent && msg.messageContent.includes('LEAVE REQUEST APPROVED')) {
      empReceivedDecisionMsg = msg;
    }
  });

  const approveRes = await request(`/leave/${empLeaveId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'APPROVED',
      adminComment: 'Approved. Enjoy your vacation!',
    },
  });
  console.log('  ✅ Admin approved leave request:', approveRes.data.data.status);

  await new Promise(r => setTimeout(r, 1200));
  const empMsgsRes = await request(`/chat/conversations/${empAdminConv.id}/messages`, {
    headers: { Authorization: `Bearer ${empToken}` },
  });
  const decisionMsg = empMsgsRes.data.data.find(m => m.messageContent.includes('LEAVE REQUEST APPROVED'));
  if (!decisionMsg) throw new Error('Automatic message update for approved leave not found in employee chat');
  console.log('  ✅ Automatic message update sent to employee in chat:');
  console.log('     ', decisionMsg.messageContent.replace(/\n/g, ' '));

  // 4. Test Food Owner Leave Request -> Notifications for Admin AND Employees + Readable message in chat box
  console.log('\n👉 [4/6] Testing Food Owner Leave Request -> Triggers notifications for Admin and Employees, and appears in chat...');
  let empFoodNoticeMsg = null;
  empSocket.on('receive_message', (msg) => {
    if (msg.messageContent && msg.messageContent.includes('CAFETERIA LEAVE & CLOSURE NOTICE')) {
      empFoodNoticeMsg = msg;
    }
  });

  const foodLeaveRes = await request('/leave', {
    method: 'POST',
    headers: { Authorization: `Bearer ${foodOwnerToken}` },
    body: {
      leaveType: 'OTHER',
      startDate: '2026-12-10',
      endDate: '2026-12-11',
      totalDays: 2,
      reason: 'Annual cafeteria kitchen sanitation, deep cleaning, and equipment servicing.',
    },
  });
  const foodLeaveId = foodLeaveRes.data.data.id;
  console.log('  ✅ Food Owner leave submitted, Leave ID:', foodLeaveId);

  // Verify Admin notifications
  const adminNotifs2 = await request('/notifications', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminFoodNotif = adminNotifs2.data.data.find(n => n.title === 'Cafeteria Leave Notice');
  if (!adminFoodNotif) throw new Error('Admin did not receive Cafeteria Leave Notice notification');
  console.log('  ✅ Admin received Cafeteria Leave Notice notification:', adminFoodNotif.message);

  // Verify Employee notifications
  const empNotifs = await request('/notifications', {
    headers: { Authorization: `Bearer ${empToken}` },
  });
  const empFoodNotif = empNotifs.data.data.find(n => n.title === 'Cafeteria Closure Notice');
  if (!empFoodNotif) throw new Error('Employee did not receive Cafeteria Closure Notice notification');
  console.log('  ✅ Employee received Cafeteria Closure Notice notification:', empFoodNotif.message);

  // Verify readable message in chat box
  await new Promise(r => setTimeout(r, 1200));
  const foodAdminConv = (await request('/chat/conversations', {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).data.data.find(c => c.otherUser && c.otherUser.id === foodOwnerId);
  if (!foodAdminConv) throw new Error('Conversation between Food Owner and Admin not found');

  const foodAdminMsgs = await request(`/chat/conversations/${foodAdminConv.id}/messages`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const foodLeaveChatMsg = foodAdminMsgs.data.data.find(m => m.messageContent.includes('CAFETERIA LEAVE & CLOSURE NOTICE'));
  if (!foodLeaveChatMsg) throw new Error('Readable Cafeteria Leave notice not found in Admin chat');
  console.log('  ✅ Food owner leave appears as readable message in Admin chat box');

  const foodEmpConv = (await request('/chat/conversations', {
    headers: { Authorization: `Bearer ${empToken}` },
  })).data.data.find(c => c.otherUser && c.otherUser.id === foodOwnerId);
  if (foodEmpConv) {
    const foodEmpMsgs = await request(`/chat/conversations/${foodEmpConv.id}/messages`, {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    const foundEmpMsg = foodEmpMsgs.data.data.find(m => m.messageContent.includes('CAFETERIA LEAVE & CLOSURE NOTICE'));
    if (foundEmpMsg) {
      console.log('  ✅ Food owner leave appears as readable message in Employee chat box');
    }
  }

  // 5. Test Admin Decision for Food Owner Leave -> Automatic message update
  console.log('\n👉 [5/6] Testing Admin Reject Decision for Food Owner Leave -> Automatic message update...');
  const rejectRes = await request(`/leave/${foodLeaveId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'REJECTED',
      adminComment: 'Please reschedule sanitation after the VIP corporate delegation visit.',
    },
  });
  console.log('  ✅ Admin rejected food leave request:', rejectRes.data.data.status);

  await new Promise(r => setTimeout(r, 1200));
  const foMsgsRes = await request(`/chat/conversations/${foodAdminConv.id}/messages`, {
    headers: { Authorization: `Bearer ${foodOwnerToken}` },
  });
  const rejectChatMsg = foMsgsRes.data.data.find(m => m.messageContent.includes('LEAVE REQUEST REJECTED'));
  if (!rejectChatMsg) throw new Error('Automatic message update for rejected food leave not found in Food Owner chat');
  console.log('  ✅ Food owner received automatic rejection message in chat box:');
  console.log('     ', rejectChatMsg.messageContent.replace(/\n/g, ' '));

  // 6. Test Chat Features: Pin/Unpin, Forward, Delete
  console.log('\n👉 [6/6] Testing Chat Features (Pin, Forward, Delete)...');

  // Send a test message from Employee Arun to Admin
  const sendRes = await request(`/chat/conversations/${empAdminConv.id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${empToken}` },
    body: {
      messageContent: 'Test Message for Pin, Forward, and Delete verification.',
      messageType: 'TEXT',
    },
  });
  const testMsgId = sendRes.data.data.id;
  console.log('  ✅ Test message sent. Message ID:', testMsgId);

  // A. Test Pin Message
  const pinRes = await request(`/chat/messages/${testMsgId}/pin`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${empToken}` },
  });
  if (!pinRes.data.data.isPinned) throw new Error('Message pin failed');
  console.log('  ✅ Message pinned successfully. isPinned =', pinRes.data.data.isPinned);

  // Unpin message
  const unpinRes = await request(`/chat/messages/${testMsgId}/pin`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${empToken}` },
  });
  if (unpinRes.data.data.isPinned) throw new Error('Message unpin failed');
  console.log('  ✅ Message unpinned successfully. isPinned =', unpinRes.data.data.isPinned);

  // B. Test Forward Message
  // Forward to Priya (empB)
  const forwardRes = await request(`/chat/messages/${testMsgId}/forward`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${empToken}` },
    body: {
      targetUserIds: [empBId],
    },
  });
  if (!forwardRes.data.data || forwardRes.data.data.length === 0) throw new Error('Message forward failed');
  console.log('  ✅ Message forwarded successfully. Forwarded count:', forwardRes.data.data.length);
  const forwardedMsg = forwardRes.data.data[0];
  if (!forwardedMsg.isForwarded) throw new Error('Forwarded message flag isForwarded is not true');
  console.log('  ✅ Forwarded message has isForwarded = true.');

  // C. Test Delete Message
  const delRes = await request(`/chat/messages/${testMsgId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${empToken}` },
  });
  if (!delRes.data.data.isDeleted) throw new Error('Message delete failed');
  console.log('  ✅ Message deleted successfully. isDeleted =', delRes.data.data.isDeleted);

  adminSocket.disconnect();
  empSocket.disconnect();
  foodOwnerSocket.disconnect();

  console.log('\n====================================================');
  console.log('🎉 ALL BACKEND LEAVE & CHAT INTEGRATION TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err.data || err.message);
  process.exit(1);
});
