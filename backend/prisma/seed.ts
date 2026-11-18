import { PrismaClient, AttendanceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { subDays, startOfDay, addHours, addMinutes } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Cleanup
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.attendanceCorrection.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.break.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.companySetting.deleteMany();
  await prisma.refreshToken.deleteMany();

  // ============================================================
  // COMPANY SETTINGS
  // ============================================================
  await prisma.companySetting.create({
    data: {
      companyName: 'TechCorp Solutions Pvt. Ltd.',
      officeStartTime: '09:00',
      officeEndTime: '18:00',
      requiredHours: 480,
      lateThresholdMinutes: 15,
      overtimeThresholdMinutes: 0,
      halfDayMinutes: 240,
      workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      breakLimitMinutes: 60,
    },
  });

  // ============================================================
  // DEPARTMENTS
  // ============================================================
  const depts = await Promise.all([
    prisma.department.create({ data: { name: 'Information Technology', description: 'Software development and IT infrastructure' } }),
    prisma.department.create({ data: { name: 'Human Resources', description: 'Employee management and recruitment' } }),
    prisma.department.create({ data: { name: 'Finance', description: 'Financial planning and accounting' } }),
    prisma.department.create({ data: { name: 'Marketing', description: 'Marketing and brand management' } }),
  ]);

  const [itDept, hrDept, financeDept, marketingDept] = depts;

  // ============================================================
  // ADMIN USER
  // ============================================================
  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@techcorp.com',
      password: adminPassword,
      role: 'ADMIN',
      isRegistered: true,
    },
  });

  // Create admin employee record
  await prisma.employee.create({
    data: {
      employeeId: 'A001',
      userId: adminUser.id,
      name: 'System Administrator',
      email: 'admin@techcorp.com',
      phone: '+91 9876543210',
      departmentId: hrDept.id,
      designation: 'System Admin',
      joiningDate: new Date('2020-01-15'),
      status: 'ACTIVE',
    },
  });

  // ============================================================
  // EMPLOYEES (pre-registered with passwords for demo)
  // ============================================================
  const employeeData = [
    { id: 'E001', name: 'Arun Kumar', email: 'arun.kumar@techcorp.com', phone: '+91 9876543001', dept: itDept.id, designation: 'Senior Software Engineer' },
    { id: 'E002', name: 'Priya Sharma', email: 'priya.sharma@techcorp.com', phone: '+91 9876543002', dept: itDept.id, designation: 'Frontend Developer' },
    { id: 'E003', name: 'Ravi Patel', email: 'ravi.patel@techcorp.com', phone: '+91 9876543003', dept: itDept.id, designation: 'Backend Developer' },
    { id: 'E004', name: 'Sneha Reddy', email: 'sneha.reddy@techcorp.com', phone: '+91 9876543004', dept: hrDept.id, designation: 'HR Manager' },
    { id: 'E005', name: 'Rahul Mehta', email: 'rahul.mehta@techcorp.com', phone: '+91 9876543005', dept: financeDept.id, designation: 'Finance Analyst' },
    { id: 'E006', name: 'Kavya Nair', email: 'kavya.nair@techcorp.com', phone: '+91 9876543006', dept: marketingDept.id, designation: 'Marketing Manager' },
    { id: 'E007', name: 'Arjun Singh', email: 'arjun.singh@techcorp.com', phone: '+91 9876543007', dept: itDept.id, designation: 'DevOps Engineer' },
    { id: 'E008', name: 'Meera Krishnan', email: 'meera.krishnan@techcorp.com', phone: '+91 9876543008', dept: hrDept.id, designation: 'HR Executive' },
    { id: 'E009', name: 'Vikram Joshi', email: 'vikram.joshi@techcorp.com', phone: '+91 9876543009', dept: financeDept.id, designation: 'Senior Accountant' },
    { id: 'E010', name: 'Deepa Thomas', email: 'deepa.thomas@techcorp.com', phone: '+91 9876543010', dept: marketingDept.id, designation: 'Digital Marketing Specialist' },
  ];

  const empPassword = await bcrypt.hash('Employee@123', 12);
  const employees = [];

  for (const emp of employeeData) {
    const user = await prisma.user.create({
      data: { email: emp.email, password: empPassword, role: 'EMPLOYEE', isRegistered: true },
    });
    const employee = await prisma.employee.create({
      data: {
        employeeId: emp.id,
        userId: user.id,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        departmentId: emp.dept,
        designation: emp.designation,
        joiningDate: new Date('2022-06-01'),
        status: 'ACTIVE',
      },
    });
    employees.push(employee);
  }

  // ============================================================
  // HOLIDAYS
  // ============================================================
  await Promise.all([
    prisma.holiday.create({ data: { name: 'Republic Day', date: new Date('2026-01-26'), isRecurring: true } }),
    prisma.holiday.create({ data: { name: 'Holi', date: new Date('2026-03-14'), isRecurring: false } }),
    prisma.holiday.create({ data: { name: 'Good Friday', date: new Date('2026-04-03'), isRecurring: false } }),
    prisma.holiday.create({ data: { name: 'Independence Day', date: new Date('2026-08-15'), isRecurring: true } }),
    prisma.holiday.create({ data: { name: 'Gandhi Jayanti', date: new Date('2026-10-02'), isRecurring: true } }),
    prisma.holiday.create({ data: { name: 'Diwali', date: new Date('2026-11-08'), isRecurring: false } }),
    prisma.holiday.create({ data: { name: 'Christmas', date: new Date('2026-12-25'), isRecurring: true } }),
  ]);

  // ============================================================
  // ATTENDANCE HISTORY (last 30 days)
  // ============================================================
  const today = new Date();

  for (const employee of employees) {
    for (let i = 30; i >= 1; i--) {
      const date = subDays(today, i);
      const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Random attendance pattern
      const rand = Math.random();
      let status: AttendanceStatus = 'PRESENT';
      let entryHour = 9;
      let entryMin = Math.floor(Math.random() * 15); // 09:00-09:15 normal
      let exitHour = 18;
      let exitMin = Math.floor(Math.random() * 30);
      let isLateFlag = false;
      let lateMinutes = 0;

      if (rand < 0.05) {
        // Absent
        status = 'ABSENT';
        await prisma.attendance.create({
          data: { employeeId: employee.id, date: startOfDay(date), status: 'ABSENT' },
        });
        continue;
      } else if (rand < 0.12) {
        // Late
        entryHour = 9;
        entryMin = 20 + Math.floor(Math.random() * 40); // 09:20-09:60 (late)
        if (entryMin >= 60) { entryHour = 10; entryMin -= 60; }
        isLateFlag = true;
        lateMinutes = (entryHour * 60 + entryMin) - (9 * 60 + 15);
        status = 'LATE';
      } else if (rand < 0.15) {
        // Half day
        exitHour = 13;
        exitMin = 0;
        status = 'HALF_DAY';
      }

      const entryTime = new Date(date);
      entryTime.setHours(entryHour, entryMin, 0, 0);

      const exitTime = new Date(date);
      exitTime.setHours(exitHour, exitMin, 0, 0);

      // Break: 1:00 PM - 1:30 PM
      const breakStart = new Date(date);
      breakStart.setHours(13, 0, 0, 0);
      const breakEnd = new Date(date);
      breakEnd.setHours(13, 30, 0, 0);

      const totalBreakMin = status === 'HALF_DAY' ? 0 : 30;
      const grossWork = Math.floor((exitTime.getTime() - entryTime.getTime()) / 60000);
      const totalWorkMin = Math.max(0, grossWork - totalBreakMin);
      const overtimeMin = Math.max(0, totalWorkMin - 480);

      const attendance = await prisma.attendance.create({
        data: {
          employeeId: employee.id,
          date: startOfDay(date),
          entryTime,
          exitTime,
          totalWorkMinutes: totalWorkMin,
          totalBreakMinutes: totalBreakMin,
          overtimeMinutes: overtimeMin,
          lateMinutes,
          isLate: isLateFlag,
          isOvertime: overtimeMin > 0,
          status,
        },
      });

      // Add break record
      if (status !== 'HALF_DAY') {
        await prisma.break.create({
          data: {
            attendanceId: attendance.id,
            startTime: breakStart,
            endTime: breakEnd,
            durationMinutes: 30,
          },
        });
      }
    }
  }

  // ============================================================
  // TODAY'S ATTENDANCE (some employees already checked in)
  // ============================================================
  const todayDate = startOfDay(today);
  const currentHour = today.getHours();

  for (let i = 0; i < 6; i++) {
    const emp = employees[i];
    const entryTime = new Date(today);
    entryTime.setHours(9, 5 + i, 0, 0);

    const attendance = await prisma.attendance.create({
      data: {
        employeeId: emp.id,
        date: todayDate,
        entryTime,
        status: 'PRESENT',
        isLate: false,
      },
    });

    // Add a completed break for first 3
    if (i < 3 && currentHour >= 13) {
      const bs = new Date(today); bs.setHours(13, 0, 0, 0);
      const be = new Date(today); be.setHours(13, 30, 0, 0);
      await prisma.break.create({
        data: { attendanceId: attendance.id, startTime: bs, endTime: be, durationMinutes: 30 },
      });
      await prisma.attendance.update({
        where: { id: attendance.id },
        data: { totalBreakMinutes: 30 },
      });
    }
  }

  // ============================================================
  // LEAVE REQUESTS
  // ============================================================
  await prisma.leaveRequest.create({
    data: {
      employeeId: employees[3].id, // Sneha
      leaveType: 'CASUAL',
      startDate: addDays(today, 3),
      endDate: addDays(today, 3),
      totalDays: 1,
      reason: 'Family function',
      status: 'PENDING',
    },
  });

  await prisma.leaveRequest.create({
    data: {
      employeeId: employees[1].id, // Priya
      leaveType: 'SICK',
      startDate: subDays(today, 5),
      endDate: subDays(today, 4),
      totalDays: 2,
      reason: 'Fever and cold, doctor recommended rest',
      status: 'APPROVED',
      adminComment: 'Get well soon',
      reviewedAt: subDays(today, 6),
    },
  });

  await prisma.leaveRequest.create({
    data: {
      employeeId: employees[4].id, // Rahul
      leaveType: 'EMERGENCY',
      startDate: addDays(today, 1),
      endDate: addDays(today, 2),
      totalDays: 2,
      reason: 'Medical emergency in family',
      status: 'PENDING',
    },
  });

  await prisma.leaveRequest.create({
    data: {
      employeeId: employees[5].id, // Kavya
      leaveType: 'CASUAL',
      startDate: subDays(today, 10),
      endDate: subDays(today, 10),
      totalDays: 1,
      reason: 'Personal work',
      status: 'REJECTED',
      adminComment: 'Please plan leaves in advance',
      reviewedAt: subDays(today, 11),
    },
  });

  // ============================================================
  // NOTIFICATIONS
  // ============================================================
  for (const emp of employees.slice(0, 4)) {
    const user = await prisma.user.findUnique({ where: { email: emp.email } });
    if (user) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'Welcome to Attendance System!',
          message: 'Your account is active. Use the Employee Dashboard to mark your daily attendance.',
          type: 'SUCCESS',
          isRead: false,
        },
      });
    }
  }

  console.log('✅ Database seeded successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('   Admin: admin@techcorp.com / Admin@123');
  console.log('   Employees: arun.kumar@techcorp.com / Employee@123');
  console.log('   (All 10 employees use password: Employee@123)');
  console.log('\n   Note: New employees must register using their Employee ID + Email');
  console.log('   (The above employees are pre-registered for demo purposes)');
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
