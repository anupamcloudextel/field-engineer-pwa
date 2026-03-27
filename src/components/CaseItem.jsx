import StatusChip from './StatusChip';

export default function CaseItem({ case: c, onClick }) {
  const caseNumber = c.CaseNumber ?? c.caseNumber ?? 'N/A';
  const status = c.Status ?? c.status ?? 'Unknown';
  // LOB: Line of Business - controls which fields to show
  const lob = (c.Line_of_Business__c ?? c.LOB__c ?? c.lineOfBusiness ?? '').trim();
  const lobNormalized = lob.toLowerCase();

  const getVal = (obj, ...keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return 'N/A';
  };

  const siteId = getVal(c, 'Site_ID__c', 'siteId');
  const actualIncidentTimeCustomer = getVal(
    c,
    'Outage_Start_Time_Customer__c',
    'OutageStartTimeCustomer__c',
    'outageStartTimeCustomer'
  );

  // OHFC identifiers
  const circuitId = getVal(c, 'Circuit_ID__c', 'Circuit_Id__c', 'CircuitId__c', 'circuitId');
  const consoleId = getVal(c, 'Console_Route_ID__c', 'Console_Id__c', 'ConsoleId__c', 'consoleId');
  const linkName = getVal(c, 'PathName__c', 'Line_Name__c', 'LineName__c', 'Link_Name__c', 'lineName');

  // FTTH identifiers
  const gponId = getVal(c, 'GPON_ID__c', 'GPONID__c', 'gponId');
  const fatNumber = getVal(c, 'FAT_Number__c', 'FATNumber__c', 'fatNumber');

  const isOHFC = lobNormalized === 'ohfc';
  const isFTTH = lobNormalized === 'ftth';
  const showSiteId = !isOHFC && !isFTTH;

  const slaStatus = getVal(c, 'SLA_Status__c', 'slaStatus');
  const calculateSla = getVal(c, 'Calculate_SLA__c', 'calculateSla');

  const createdDateRaw = c.CreatedDate ?? c.createdDate;
  const createdDate = createdDateRaw ? new Date(createdDateRaw) : null;
  const formattedCreatedDate = createdDate
    ? createdDate.toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    })
    : 'N/A';

  const getSlaStatus = () => {
    if (!createdDate) return null;
    const now = new Date();
    const target = new Date(createdDate.getTime() + 4 * 60 * 60 * 1000);
    const diffMs = now - target;
    const isOverdue = diffMs > 0;
    const absDiff = Math.abs(diffMs);
    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    const mins = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
    const timeStr = `${hours}:${mins < 10 ? '0' : ''}${mins}`;

    return {
      label: isOverdue ? `${timeStr} overdue` : `${timeStr} remaining`,
      isOverdue
    };
  };

  const slaInfo = getSlaStatus();

  return (
    <li>
      <button
        onClick={onClick}
        className="w-full text-left p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition tap-highlight-none active:scale-[0.99]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-indigo-600 text-base sm:text-lg">
              Case #{caseNumber}
            </p>
            <dl className="mt-2 text-slate-600 text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2">
              {showSiteId && (
                <div className="min-w-0">
                  <dt className="text-slate-500 font-medium">Site ID</dt>
                  <dd className="truncate" title={siteId !== 'N/A' ? siteId : undefined}>{siteId}</dd>
                </div>
              )}

              <div className="min-w-0">
                <dt className="text-slate-500 font-medium">LOB</dt>
                <dd className="truncate" title={lob ? lob : undefined}>{lob || 'N/A'}</dd>
              </div>

              <div className="min-w-0 sm:col-span-2">
                <dt className="text-slate-500 font-medium">Actual Incident Time - Customer</dt>
                <dd className="break-words whitespace-normal" title={actualIncidentTimeCustomer !== 'N/A' ? actualIncidentTimeCustomer : undefined}>
                  {actualIncidentTimeCustomer}
                </dd>
              </div>

              {(slaStatus !== 'N/A' || calculateSla !== 'N/A') && (
                <div className="min-w-0 sm:col-span-2 border-t border-slate-100 pt-2 mt-1">
                  <dt className="text-slate-500 font-medium flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    SLA Status
                  </dt>
                  <dd className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${slaStatus.toLowerCase().includes('breach') ? 'text-red-600' :
                      slaStatus.toLowerCase().includes('met') ? 'text-emerald-600' : 'text-slate-700'
                      }`}>
                      {slaStatus}
                    </span>
                    {calculateSla !== 'N/A' && (
                      <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
                        {calculateSla}
                      </span>
                    )}
                  </dd>
                </div>
              )}

              {isOHFC && (
                <>
                  <div className="min-w-0">
                    <dt className="text-slate-500 font-medium">Link Name</dt>
                    <dd className="truncate" title={linkName !== 'N/A' ? linkName : undefined}>{linkName}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-slate-500 font-medium">Circuit ID</dt>
                    <dd className="truncate" title={circuitId !== 'N/A' ? circuitId : undefined}>{circuitId}</dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-slate-500 font-medium">Console ID</dt>
                    <dd className="break-words whitespace-normal" title={consoleId !== 'N/A' ? consoleId : undefined}>{consoleId}</dd>
                  </div>
                </>
              )}

              {isFTTH && (
                <>
                  <div className="min-w-0">
                    <dt className="text-slate-500 font-medium">GPON ID</dt>
                    <dd className="truncate" title={gponId !== 'N/A' ? gponId : undefined}>{gponId}</dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-slate-500 font-medium">FAT Number</dt>
                    <dd className="break-words whitespace-normal" title={fatNumber !== 'N/A' ? fatNumber : undefined}>
                      {fatNumber}
                    </dd>
                  </div>
                </>
              )}

              <div className="min-w-0 sm:col-span-2 border-t border-slate-100 pt-2 mt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <dt className="text-slate-500 font-medium">Created Date</dt>
                    <dd className="text-slate-700">{formattedCreatedDate}</dd>
                  </div>
                  {slaInfo && (
                    <div>
                      <dt className="text-slate-500 font-medium">SLA (4 Hours)</dt>
                      <dd className={`font-bold ${slaInfo.isOverdue ? 'text-red-600' : 'text-emerald-600'}`}>
                        {slaInfo.label}
                      </dd>
                    </div>
                  )}
                </div>
              </div>
            </dl>
          </div>
          <StatusChip status={status} />
        </div>
      </button>
    </li>
  );
}
