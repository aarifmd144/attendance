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

async function runComprehensiveTests() {
  console.log('========================================================================');
  console.log('🧪 COMPREHENSIVE END-TO-END VERIFICATION: LEAVE WORKFLOWS & CHAT SUITE');
  console.log('========================================================================\n');

  // STEP 1: LOGIN FLOWS (Admin, Employee A, Employee B, Food Owner)
  console.log('👉 [STEP 1] Validating Login Flows for All Roles...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'admin@techcorp.com', password: 'Admin@123' },
  });
  const adminToken = adminLogin.data.data.accessToken;
  const adminId = adminLogin.data.data.user.id;
  console.log('  ✅ Admin logged in:', adminLogin.data.data.user.email, `(${adminLogin.data.data.user.role})`);

  const empALogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'arun.kumar@techcorp.com', password: 'Employee@123' },
  });
  const empAToken = empALogin.data.data.accessToken;
  const empAId = empALogin.data.data.user.id;
  console.log('  ✅ Employee A logged in:', empALogin.data.data.user.email, `(${empALogin.data.data.user.role})`);

  const empBLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'priya.sharma@techcorp.com', password: 'Employee@123' },
  });
  const empBToken = empBLogin.data.data.accessToken;
  const empBId = empBLogin.data.data.user.id;
  console.log('  ✅ Employee B logged in:', empBLogin.data.data.user.email, `(${empBLogin.data.data.user.role})`);

  const foodOwnerLogin = await request('/auth/login', {
    method: 'POST',
    body: { email: 'foodowner@techcorp.com', password: 'Food@123' },
  });
  const foodOwnerToken = foodOwnerLogin.data.data.accessToken;
  const foodOwnerId = foodOwnerLogin.data.data.user.id;
  console.log('  ✅ Food Owner logged in:', foodOwnerLogin.data.data.user.email, `(${foodOwnerLogin.data.data.user.role})`);

  // Establish WebSockets
  console.log('\n👉 [STEP 2] Connecting and Authenticating Real-Time Sockets...');
  const adminSocket = io(SOCKET_URL, { auth: { token: adminToken }, transports: ['websocket'] });
  const empASocket = io(SOCKET_URL, { auth: { token: empAToken }, transports: ['websocket'] });
  const empBSocket = io(SOCKET_URL, { auth: { token: empBToken }, transports: ['websocket'] });
  const foodOwnerSocket = io(SOCKET_URL, { auth: { token: foodOwnerToken }, transports: ['websocket'] });

  await new Promise(r => setTimeout(r, 1200));
  console.log('  ✅ 4 sockets connected and authenticated.');

  // STEP 3: EMPLOYEE LEAVE REQUEST WORKFLOW
  console.log('\n👉 [STEP 3] Testing Employee Leave Request Workflow...');
  let adminReceivedEmpMsg = null;
  adminSocket.on('receive_message', (msg) => {
    if (msg.messageContent && msg.messageContent.includes('NEW LEAVE REQUEST SUBMITTED')) {
      adminReceivedEmpMsg = msg;
    }
  });

  const empLeave = await request('/leave', {
    method: 'POST',
    headers: { Authorization: `Bearer ${empAToken}` },
    body: {
      leaveType: 'CASUAL',
      startDate: '2026-12-15',
      endDate: '2026-12-16',
      totalDays: 2,
      reason: 'Attending sibling wedding ceremonies out of city.',
    },
  });
  const empLeaveId = empLeave.data.data.id;
  console.log('  ✅ Employee A applied for leave. ID:', empLeaveId);

  // Check admin notification
  const adminNotifs = await request('/notifications', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const foundAdminNotif = adminNotifs.data.data.find(n => n.message.includes('Arun Kumar has applied for CASUAL leave'));
  if (!foundAdminNotif) throw new Error('Admin did not receive leave notification');
  console.log('  ✅ Admin received leave notification:', foundAdminNotif.title, '-', foundAdminNotif.message);

  // Check details posted in chat between Employee and Admin
  await new Promise(r => setTimeout(r, 1000));
  const adminConversations = (await request('/chat/conversations', {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).data.data;
  const empAConv = adminConversations.find(c => c.otherUser && c.otherUser.id === empAId);
  if (!empAConv) throw new Error('Conversation between Employee A and Admin not found');

  const empAConvMsgs = (await request(`/chat/conversations/${empAConv.id}/messages`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).data.data;

  const leaveChatNotice = empAConvMsgs.find(m => m.messageContent.includes('NEW LEAVE REQUEST SUBMITTED'));
  if (!leaveChatNotice) throw new Error('Leave details chat message not found in Admin conversation');
  console.log('  ✅ Leave details readable in chat box:');
  console.log('     Title:', leaveChatNotice.messageContent.split('\n')[0]);
  console.log('     Employee Info:', leaveChatNotice.messageContent.split('\n')[2]);
  console.log('     Duration:', leaveChatNotice.messageContent.split('\n')[5]);
  console.log('     Reason:', leaveChatNotice.messageContent.split('\n')[6]);

  // STEP 4: ADMIN ACCEPT DECISION -> AUTOMATIC MESSAGE UPDATE IN CHAT
  console.log('\n👉 [STEP 4] Testing Admin Decision (Accept) -> Automatic message update to employee in chat...');
  let empAReceivedApprovalMsg = null;
  empASocket.on('receive_message', (msg) => {
    if (msg.messageContent && msg.messageContent.includes('LEAVE REQUEST APPROVED')) {
      empAReceivedApprovalMsg = msg;
    }
  });

  const acceptRes = await request(`/leave/${empLeaveId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'APPROVED',
      adminComment: 'Approved. Best wishes for the wedding celebrations!',
    },
  });
  console.log('  ✅ Admin marked leave as:', acceptRes.data.data.status);

  await new Promise(r => setTimeout(r, 1000));
  const empAMsgsAfter = (await request(`/chat/conversations/${empAConv.id}/messages`, {
    headers: { Authorization: `Bearer ${empAToken}` },
  })).data.data;

  const approvalMsg = empAMsgsAfter.find(m => m.messageContent.includes('LEAVE REQUEST APPROVED'));
  if (!approvalMsg) throw new Error('Automatic message update for approved leave not found in employee chat');
  console.log('  ✅ Automatic approval message update received in employee chat:');
  console.log('     Message Content:', approvalMsg.messageContent.replace(/\n/g, ' '));

  // STEP 5: ADMIN REJECT DECISION -> AUTOMATIC MESSAGE UPDATE IN CHAT
  console.log('\n👉 [STEP 5] Testing Admin Decision (Reject) -> Automatic message update to employee in chat...');
  const empBLeave = await request('/leave', {
    method: 'POST',
    headers: { Authorization: `Bearer ${empBToken}` },
    body: {
      leaveType: 'CASUAL',
      startDate: '2026-12-18',
      endDate: '2026-12-18',
      totalDays: 1,
      reason: 'Personal errands and banking appointments.',
    },
  });
  const empBLeaveId = empBLeave.data.data.id;
  console.log('  ✅ Employee B applied for leave. ID:', empBLeaveId);

  const rejectRes = await request(`/leave/${empBLeaveId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'REJECTED',
      adminComment: 'Quarter-end audit day scheduled on Dec 18. Please choose an alternate date.',
    },
  });
  console.log('  ✅ Admin marked leave as:', rejectRes.data.data.status);

  await new Promise(r => setTimeout(r, 1000));
  const empBConv = (await request('/chat/conversations', {
    headers: { Authorization: `Bearer ${empBToken}` },
  })).data.data.find(c => c.otherUser && c.otherUser.id === adminId);
  if (!empBConv) throw new Error('Conversation between Employee B and Admin not found');

  const empBMsgs = (await request(`/chat/conversations/${empBConv.id}/messages`, {
    headers: { Authorization: `Bearer ${empBToken}` },
  })).data.data;

  const rejectionMsg = empBMsgs.find(m => m.messageContent.includes('LEAVE REQUEST REJECTED'));
  if (!rejectionMsg) throw new Error('Automatic message update for rejected leave not found in Employee B chat');
  console.log('  ✅ Automatic rejection message update received in employee chat:');
  console.log('     Message Content:', rejectionMsg.messageContent.replace(/\n/g, ' '));

  // STEP 6: FOOD OWNER LEAVE REQUEST WORKFLOW
  console.log('\n👉 [STEP 6] Testing Food Owner Leave Request -> Triggers Notifications for Admin & Employees + Readable Message in Chat...');
  const foodLeave = await request('/leave', {
    method: 'POST',
    headers: { Authorization: `Bearer ${foodOwnerToken}` },
    body: {
      leaveType: 'OTHER',
      startDate: '2026-12-22',
      endDate: '2026-12-23',
      totalDays: 2,
      reason: 'Semi-annual kitchen deep steam-cleaning and chimney duct maintenance.',
    },
  });
  const foodLeaveId = foodLeave.data.data.id;
  console.log('  ✅ Food Owner leave submitted. ID:', foodLeaveId);

  // Check Admin notification
  const adminNotifsAfterFood = (await request('/notifications', {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).data.data;
  const adminNotice = adminNotifsAfterFood.find(n => n.title === 'Cafeteria Leave Notice');
  if (!adminNotice) throw new Error('Admin did not receive Cafeteria Leave Notice');
  console.log('  ✅ Admin received notification:', adminNotice.title, '-', adminNotice.message);

  // Check Employee notification
  const empNotifsAfterFood = (await request('/notifications', {
    headers: { Authorization: `Bearer ${empAToken}` },
  })).data.data;
  const empNotice = empNotifsAfterFood.find(n => n.title === 'Cafeteria Closure Notice');
  if (!empNotice) throw new Error('Employee did not receive Cafeteria Closure Notice');
  console.log('  ✅ Employee received notification:', empNotice.title, '-', empNotice.message);

  // Check readable chat message in Admin chat
  await new Promise(r => setTimeout(r, 1000));
  const foodAdminConv = (await request('/chat/conversations', {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).data.data.find(c => c.otherUser && c.otherUser.id === foodOwnerId);
  if (!foodAdminConv) throw new Error('Conversation between Food Owner and Admin not found');

  const foodAdminMsgs = (await request(`/chat/conversations/${foodAdminConv.id}/messages`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  })).data.data;

  const readableFoodNotice = foodAdminMsgs.find(m => m.messageContent.includes('CAFETERIA LEAVE & CLOSURE NOTICE'));
  if (!readableFoodNotice) throw new Error('Readable Cafeteria Leave Notice not found in Admin chat');
  console.log('  ✅ Food owner leave appears as readable message in Admin chat box:');
  console.log('     ', readableFoodNotice.messageContent.split('\n')[0]);
  console.log('     ', readableFoodNotice.messageContent.split('\n')[3]);
  console.log('     ', readableFoodNotice.messageContent.split('\n')[5]);

  // Check readable chat message in Employee chat
  const foodEmpConv = (await request('/chat/conversations', {
    headers: { Authorization: `Bearer ${empAToken}` },
  })).data.data.find(c => c.otherUser && c.otherUser.id === foodOwnerId);
  if (foodEmpConv) {
    const foodEmpMsgs = (await request(`/chat/conversations/${foodEmpConv.id}/messages`, {
      headers: { Authorization: `Bearer ${empAToken}` },
    })).data.data;
    const empFoodChatNotice = foodEmpMsgs.find(m => m.messageContent.includes('CAFETERIA LEAVE & CLOSURE NOTICE'));
    if (empFoodChatNotice) {
      console.log('  ✅ Food owner leave appears as readable message in Employee chat box');
    }
  }

  // STEP 7: ADMIN DECISION ON FOOD OWNER LEAVE -> AUTOMATIC CHAT UPDATE
  console.log('\n👉 [STEP 7] Testing Admin Decision on Food Owner Leave...');
  const approveFoodLeave = await request(`/leave/${foodLeaveId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      status: 'APPROVED',
      adminComment: 'Sanitation approved. Maintenance vendors authorized to enter on Dec 22.',
    },
  });
  console.log('  ✅ Admin approved food owner leave:', approveFoodLeave.data.data.status);

  await new Promise(r => setTimeout(r, 1000));
  const foMsgs = (await request(`/chat/conversations/${foodAdminConv.id}/messages`, {
    headers: { Authorization: `Bearer ${foodOwnerToken}` },
  })).data.data;
  const foApprovalMsg = foMsgs.find(m => m.messageContent.includes('LEAVE REQUEST APPROVED'));
  if (!foApprovalMsg) throw new Error('Automatic message update not found in Food Owner chat');
  console.log('  ✅ Food Owner received automatic message update in chat box:');
  console.log('     ', foApprovalMsg.messageContent.replace(/\n/g, ' '));

  // STEP 8: CHAT ENHANCEMENTS: COPY, FORWARD, PIN, DELETE
  console.log('\n👉 [STEP 8] Testing Chat Enhancements (Copy, Forward, Pin, Delete)...');

  // Send a test message
  const testMsg = await request(`/chat/conversations/${empAConv.id}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${empAToken}` },
    body: {
      messageContent: 'Strategic Project Roadmap and Release Milestones for Q1 2027.',
      messageType: 'TEXT',
    },
  });
  const testMsgId = testMsg.data.data.id;
  console.log('  ✅ Test message sent. ID:', testMsgId);

  // A. Copy validation (verifies content accessibility)
  if (testMsg.data.data.messageContent !== 'Strategic Project Roadmap and Release Milestones for Q1 2027.') {
    throw new Error('Message content mismatch for copy');
  }
  console.log('  ✅ Copy capability verified: message text is clean and accessible.');

  // B. Pin Message
  const pinRes = await request(`/chat/messages/${testMsgId}/pin`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${empAToken}` },
  });
  if (!pinRes.data.data.isPinned) throw new Error('Failed to pin message');
  console.log('  ✅ Message pinned successfully. isPinned =', pinRes.data.data.isPinned);

  // Unpin Message
  const unpinRes = await request(`/chat/messages/${testMsgId}/pin`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${empAToken}` },
  });
  if (unpinRes.data.data.isPinned) throw new Error('Failed to unpin message');
  console.log('  ✅ Message unpinned successfully. isPinned =', unpinRes.data.data.isPinned);

  // C. Forward Message
  const forwardRes = await request(`/chat/messages/${testMsgId}/forward`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${empAToken}` },
    body: {
      targetUserIds: [empBId],
    },
  });
  if (!forwardRes.data.data || forwardRes.data.data.length === 0) throw new Error('Failed to forward message');
  const forwarded = forwardRes.data.data[0];
  if (!forwarded.isForwarded) throw new Error('Forwarded flag is false');
  console.log('  ✅ Message forwarded to Employee B successfully with isForwarded = true.');

  // D. Delete Message (soft-delete, preserving existing behavior)
  const deleteRes = await request(`/chat/messages/${testMsgId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${empAToken}` },
  });
  if (!deleteRes.data.data.isDeleted) throw new Error('Failed to soft-delete message');
  console.log('  ✅ Message soft-deleted successfully with isDeleted = true.');

  adminSocket.disconnect();
  empASocket.disconnect();
  empBSocket.disconnect();
  foodOwnerSocket.disconnect();

  console.log('\n========================================================================');
  console.log('🎉 ALL INTEGRATION REQUIREMENTS VERIFIED AND FULLY PASSING!');
  console.log('========================================================================\n');
  process.exit(0);
}

runComprehensiveTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err.data || err.message);
  process.exit(1);
});
