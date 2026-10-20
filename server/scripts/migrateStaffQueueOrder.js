require('dotenv').config();
const { db, admin } = require('../config/firebase');

async function main() {
  const apply = process.argv.includes('--apply');
  const orderArgument = process.argv.find((argument) => argument.startsWith('--order='));
  const staffSnapshot = await db.collection('staff').get();
  const staff = staffSnapshot.docs;

  if (staff.length > 9) {
    throw new Error(
      `พบหมอนวด ${staff.length} รายการ รูปแบบเลขคิวปัจจุบันรองรับได้สูงสุด 9 คน; ไม่มีการแก้ข้อมูล`
    );
  }

  console.log(`พบเอกสารหมอนวด ${staff.length} รายการ:`);
  staff.forEach((doc) => {
    const data = doc.data();
    console.log(`  ${doc.id}\t${data.name || '(ไม่มีชื่อ)'}\tqueueOrder=${data.queueOrder ?? '(ยังไม่กำหนด)'}`);
  });

  if (!orderArgument) {
    console.log(
      '\nDry run เท่านั้น: ตรวจสอบลำดับที่ต้องการ แล้วระบุ ID ตามลำดับด้วย --order=id1,id2,...'
    );
    console.log('เมื่อตรวจสอบแล้วจึงเพิ่ม --apply เพื่อเขียนเฉพาะฟิลด์ queueOrder และตัวนับ staff-queue-order');
    return;
  }

  const orderedIds = orderArgument.slice('--order='.length)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  const actualIds = new Set(staff.map((doc) => doc.id));
  if (
    orderedIds.length !== staff.length
    || new Set(orderedIds).size !== staff.length
    || orderedIds.some((id) => !actualIds.has(id))
  ) {
    throw new Error('ลำดับ ID ต้องระบุเอกสารหมอนวดทุกคนที่พบให้ครบและไม่ซ้ำ; ไม่มีการแก้ข้อมูล');
  }

  const assignments = orderedIds.map((id, index) => ({
    ref: db.collection('staff').doc(id),
    order: index + 1,
    current: staff.find((doc) => doc.id === id).data().queueOrder,
  }));
  const conflicts = assignments.filter(
    (assignment) => assignment.current != null && Number(assignment.current) !== assignment.order
  );
  if (conflicts.length) {
    throw new Error('มี queueOrder ที่กำหนดไว้แล้วแต่ไม่ตรงกับลำดับที่ระบุ; ตรวจสอบก่อน ไม่มีการแก้ข้อมูล');
  }

  console.log('\nลำดับที่จะกำหนด:');
  assignments.forEach(({ ref, order }) => console.log(`  ${order}: ${ref.id}`));
  if (!apply) {
    console.log('\nDry run สำเร็จ; ไม่ได้เขียนข้อมูล ใช้ --apply เมื่อตรวจสอบลำดับแล้วเท่านั้น');
    return;
  }

  await db.runTransaction(async (transaction) => {
    const orderCounterRef = db.collection('counters').doc('staff-queue-order');
    const currentDocs = await Promise.all(assignments.map(({ ref }) => transaction.get(ref)));
    const counterDoc = await transaction.get(orderCounterRef);
    currentDocs.forEach((doc, index) => {
      if (!doc.exists) throw new Error(`เอกสารหมอนวด ${assignments[index].ref.id} เปลี่ยนแปลง; ยกเลิก migration`);
      const currentOrder = doc.data().queueOrder;
      if (currentOrder != null && Number(currentOrder) !== assignments[index].order) {
        throw new Error(`ลำดับหมอนวด ${doc.id} เปลี่ยนแปลง; ยกเลิก migration`);
      }
    });
    const currentCount = counterDoc.exists ? Number(counterDoc.data().count) || 0 : 0;
    const maxOrder = assignments.length;
    if (currentCount > maxOrder) {
      throw new Error('ตัวนับหมอนวดสูงกว่ารายการที่ตรวจพบ; ยกเลิก migration เพื่อป้องกันเลขซ้ำ');
    }
    assignments.forEach(({ ref, order }) => {
      transaction.update(ref, { queueOrder: order });
    });
    transaction.set(orderCounterRef, { count: maxOrder });
  });
  console.log('\nกำหนด queueOrder สำเร็จ');
}

main().catch((error) => {
  console.error('Migration stopped:', error.message);
  process.exitCode = 1;
});
