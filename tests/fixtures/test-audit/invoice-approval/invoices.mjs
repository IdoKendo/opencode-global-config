export class ApprovalDenied extends Error {}

function hasPermission(caller) {
  return caller.role === 'approver';
}

function alreadyApproved(invoice) {
  return invoice.status === 'approved';
}

// Both refusals use the same public error.
export function approve(invoice, caller) {
  if (!hasPermission(caller)) throw new ApprovalDenied('Approval denied');
  if (alreadyApproved(invoice)) throw new ApprovalDenied('Approval denied');
  return { ...invoice, status: 'approved' };
}
