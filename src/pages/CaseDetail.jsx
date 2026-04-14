import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCases, updateCase, getPicklistValues, getUniqueValues } from '../api/client';

const STATUS_OPTIONS = ['In Progress', 'Assigned', 'Resolved', 'Rework', 'Closed'];

const YES_NO_OPTIONS = ['YES', 'NO'];

export default function CaseDetail() {
  const { caseId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { email } = useAuth();
  const readOnlyParam = searchParams.get('readOnly') === 'true';
  //const readOnlyParam = searchParams.get('readOnly') === 'false';

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [updating, setUpdating] = useState(false);

  const [status, setStatus] = useState('');
  const [rcaReason, setRcaReason] = useState('');
  const [rcaComments, setRcaComments] = useState('');
  const [leptonNetworkId, setLeptonNetworkId] = useState('');
  const [materialNeeded, setMaterialNeeded] = useState('');
  const [visibleMaterials, setVisibleMaterials] = useState(1);
  const [materials, setMaterials] = useState(
    Array.from({ length: 5 }, () => ({ name: '', quantity: '' }))
  );
  const [activeMaterialIndex, setActiveMaterialIndex] = useState(null); // null or 0-4
  const [vendorName, setVendorName] = useState('');
  const [civilNeeded, setCivilNeeded] = useState('');

  // Customer Updates (Restoration Updates)
  const [visibleUpdates, setVisibleUpdates] = useState(1);
  const [restorationUpdates, setRestorationUpdates] = useState(
    Array.from({ length: 10 }, () => ({ text: '', dateTime: '' }))
  );

  // Vendor section (additional fields)
  const [ceTeamAcknowledgement, setCeTeamAcknowledgement] = useState('');
  const [vendorSplicerAssigned, setVendorSplicerAssigned] = useState('');
  const [splicerAlignDateTime, setSplicerAlignDateTime] = useState('');
  const [splicerAcknowledgement, setSplicerAcknowledgement] = useState('');
  const [teamReachedTimeMarkOnSite, setTeamReachedTimeMarkOnSite] = useState('');
  const [faultIdentification, setFaultIdentification] = useState('');
  const [faultFound, setFaultFound] = useState('');
  const [restorationStart, setRestorationStart] = useState('');
  const [otherMaterials, setOtherMaterials] = useState('');
  const [cableStartReading, setCableStartReading] = useState('');
  const [cableId, setCableId] = useState('');
  const [ppeCompliance, setPpeCompliance] = useState('');
  const [cableEndReading, setCableEndReading] = useState('');
  const [aEndLatlong, setAEndLatlong] = useState('');
  const [bEndLatlong, setBEndLatlong] = useState('');
  const [extraFeUpdateCount, setExtraFeUpdateCount] = useState(0);
  const [vendorUpdateCount, setVendorUpdateCount] = useState(0);
  const [currentStatusVendor, setCurrentStatusVendor] = useState('');

  // Access Issue Fields
  const [accessIssueYesNo, setAccessIssueYesNo] = useState('');
  const [accessIssue, setAccessIssue] = useState('');
  const [accessGranted, setAccessGranted] = useState('');
  const [accessGrantedDateTime, setAccessGrantedDateTime] = useState('');
  const [remarkForAccessIssue, setRemarkForAccessIssue] = useState('');
  const [visibleVendorUpdates, setVisibleVendorUpdates] = useState(1);
  const [vendorUpdates, setVendorUpdates] = useState(
    Array.from({ length: 10 }, () => ({ text: '', dateTime: '' }))
  );
  const [checkTheLinkStatusDateTime, setCheckTheLinkStatusDateTime] = useState('');
  const [genericCauseOfCableCut, setGenericCauseOfCableCut] = useState('');
  const [delayReason, setDelayReason] = useState('');
  const [laserStatus, setLaserStatus] = useState('');
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [showRcaSheet, setShowRcaSheet] = useState(false);
  const [showGenericCauseSheet, setShowGenericCauseSheet] = useState(false);
  const [showDelayReasonSheet, setShowDelayReasonSheet] = useState(false);
  const [showCurrentStatusVendorSheet, setShowCurrentStatusVendorSheet] = useState(false);

  const [delayComments, setDelayComments] = useState('');

  const [materialOptions, setMaterialOptions] = useState(Array.from({ length: 5 }, () => []));
  const [rcaOptions, setRcaOptions] = useState([]);
  const [genericCauseOptions, setGenericCauseOptions] = useState([]);
  const [delayReasonOptions, setDelayReasonOptions] = useState([]);
  const [currentStatusVendorOptions, setCurrentStatusVendorOptions] = useState([]);

  //const isReadOnly = readOnlyParam;
  const isReadOnly = readOnlyParam && status.toLocaleLowerCase() !== 'resolved';

  const toDatetimeLocal = (v) => {
    if (v == null) return '';
    const s = String(v).trim();
    if (!s) return '';
    // Already in browser-friendly format: YYYY-MM-DDTHH:mm
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;

    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const firstNonEmpty = (obj, ...keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (v != null && String(v).trim() !== '') return v;
    }
    return '';
  };

  useEffect(() => {
    async function load() {
      if (!email || !caseId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getCases(email);
        const raw = res.cases || res.records || [];
        const userEmail = email.toLowerCase();
        const all = raw.filter((r) => {
          const siteEmail = (r.ExtIPEmail__c || r.Site__r?.IPEmail__c || r.IPEmail__c || '').trim().toLowerCase();
          return siteEmail === userEmail;
        });
        const found = all.find((c) => (c.Id || c.id) === caseId);
        if (found) {
          setCaseData(found);
          setStatus(found.Status || found.status || 'In Progress');
          setRcaReason(found.RCA_Reason__c || found.rcaReason || '');
          setRcaComments(found.RCA_Comments__c || found.rcaComments || '');
          setLeptonNetworkId(found.LEPTON_Network_Id__c || found.leptonNetworkId || '');
          const rawMaterialNeeded = (found.Material_Needed__c || found.materialNeeded || '').trim();
          // Normalise YES/NO from Salesforce to match UI options
          setMaterialNeeded(rawMaterialNeeded ? rawMaterialNeeded.toUpperCase() : '');
          setMaterials(
            Array.from({ length: 5 }, (_, i) => {
              const idx = i + 1;
              const name = found[`Material${idx}__c`] || found[`material${idx}`] || '';
              const qty = found[`Material_${idx}_Quantity__c`] != null ? String(found[`Material_${idx}_Quantity__c`]) : '';
              return { name, quantity: qty };
            })
          );

          // Calculate max visible for Materials
          let maxMatVisible = 1;
          for (let i = 5; i >= 1; i--) {
            const val = found[`Material${i}__c`] || found[`material${i}`];
            if (val && String(val).trim()) {
              maxMatVisible = i;
              break;
            }
          }
          setVisibleMaterials(maxMatVisible);
          setVendorName(found.Vendor_Name__c || found.vendorName || '');
          const rawCivilNeeded = (found.Civil_Needed__c || found.civilNeeded || '').trim();
          setCivilNeeded(rawCivilNeeded ? rawCivilNeeded.toUpperCase() : '');

          setRestorationUpdates(
            Array.from({ length: 10 }, (_, i) => {
              const idx = i + 1;
              const text = String(found[`Restoration_Update_${idx}__c`] || found[`restorationUpdate${idx}`] || '');
              const dt = toDatetimeLocal(
                found[`Restoration_Update_${idx}_Date_Time__c`] || found[`restorationUpdate${idx}DateTime`] || ''
              );
              return { text, dateTime: dt };
            })
          );

          // Calculate max visible based on data
          let maxVisible = 1;
          for (let i = 10; i >= 1; i--) {
            const val = found[`Restoration_Update_${i}__c`] || found[`restorationUpdate${i}`];
            if (val && String(val).trim()) {
              maxVisible = i;
              break;
            }
          }
          setVisibleUpdates(maxVisible);

          setCeTeamAcknowledgement(toDatetimeLocal(found.CE_Team_Acknowledgement__c || found.ceTeamAcknowledgement || ''));
          setVendorSplicerAssigned(String(found.Vendor_Splicer_Assigned__c || found.vendorSplicerAssigned || ''));
          setSplicerAlignDateTime(toDatetimeLocal(found.Splicer_Available__c || found.splicerAlignDateTime || ''));
          setSplicerAcknowledgement(
            toDatetimeLocal(found.Splicer_Acknowledgement__c || found.splicerAcknowledgement || '')
          );
          setTeamReachedTimeMarkOnSite(
            toDatetimeLocal(found.Team_Reached_Time_Mark_On_Site__c || found.teamReachedTimeMarkOnSite || '')
          );

          const rawFaultId = (found.Fault_Identification__c || found.faultIdentification || '').trim();
          setFaultIdentification(rawFaultId ? rawFaultId.toUpperCase() : '');
          setFaultFound(toDatetimeLocal(found.Fault_Found__c || found.faultFound || ''));
          setRestorationStart(toDatetimeLocal(found.Restoration_Start__c || found.restorationStart || ''));
          setOtherMaterials(String(found.Other_Materials__c || found.otherMaterials || ''));
          setCableStartReading(String(found.Cable_Start_Reading__c || found.cableStartReading || ''));
          setCableId(String(found.Cable_ID__c || found.cableId || ''));

          const rawPpe = (found.PPE_Compliance__c || found.ppeCompliance || '').trim();
          setPpeCompliance(rawPpe ? rawPpe.toUpperCase() : '');

          setCableEndReading(String(found.Cable_End_Reading__c || found.cableEndReading || ''));
          setAEndLatlong(String(found.A_Latlong__c || found.aEndLatlong || ''));
          setBEndLatlong(String(found.B_Latlong__c || found.bEndLatlong || ''));

          setVendorUpdates(
            Array.from({ length: 10 }, (_, i) => {
              const idx = i + 1;
              const textValue = found[`Vendor_Update_${idx}__c`] || found[`vendorUpdate${idx}`];
              const dtValue = found[`Vendor_Update_${idx}_Date_Time__c`] || found[`vendorUpdate${idx}DateTime`];
              return {
                text: textValue ? String(textValue) : '',
                dateTime: dtValue ? toDatetimeLocal(dtValue) : ''
              };
            })
          );

          // Calculate max visible for Vendor Updates
          let maxVendorVisible = 1;
          for (let i = 10; i >= 1; i--) {
            const val = found[`Vendor_Update_${i}__c`] || found[`vendorUpdate${i}`];
            if (val && String(val).trim()) {
              maxVendorVisible = i;
              break;
            }
          }
          setVisibleVendorUpdates(maxVendorVisible);

          setCheckTheLinkStatusDateTime(
            toDatetimeLocal(found.Check_The_Link_Status_Date_Time__c || found.checkTheLinkStatusDateTime || '')
          );
          setGenericCauseOfCableCut(String(found.Generic_Cause_of_Cable_Cut__c || found.genericCauseOfCableCut || ''));
          setDelayReason(String(found.Delay_Reason__c || found.delayReason || ''));

          const rawLaser = (found.Laser_Status__c || found.laserStatus || '').trim();
          setLaserStatus(rawLaser ? rawLaser.toUpperCase() : '');
          setDelayComments(found.Delay_Comments__c || found.delayComments || '');

          // Prioritize Field_Engineer_formula__c as requested
          const vn = found.Field_Engineer_formula__c || found.fieldEngineerFormula || found.Vendor_Name__c || found.vendorName || '';
          setVendorName(vn);

          // Initialize Access Issue Fields in correct scope
          setAccessIssueYesNo(found.Access_Issue_YES_NO__c || '');
          setAccessIssue(toDatetimeLocal(found.Access_Issue__c || ''));
          setAccessGranted(found.Access_Granted__c || '');
          setAccessGrantedDateTime(toDatetimeLocal(found.Access_Granted_Date_Time__c || ''));
          setRemarkForAccessIssue(found.Remark_For_Access_Issue__c || '');
          setCurrentStatusVendor(found.current_Status__c || '');
        } else {
          setError('Case not found');
        }
      } catch (err) {
        console.error('Error loading case:', err);
        setError('Failed to load case');
      } finally {
        setLoading(false);
      }
    }
    async function loadPicklists() {
      const picklistFields = [
        ...Array.from({ length: 5 }, (_, i) => ({
          key: `Material${i + 1}__c`,
          index: i
        })),
        { key: 'RCA_Reason__c', setter: setRcaOptions },
        { key: 'Generic_Cause_of_Cable_Cut__c', setter: setGenericCauseOptions },
        { key: 'Delay_Reason__c', setter: setDelayReasonOptions },
        { key: 'current_Status__c', setter: setCurrentStatusVendorOptions },
      ];
      try {
        await Promise.all([
          ...picklistFields.map(async (f) => {
            const res = await getPicklistValues('Case', f.key);
            if (res.success && Array.isArray(res.values) && res.values.length > 0) {
              if (f.index !== undefined) {
                setMaterialOptions(prev => {
                  const next = [...prev];
                  next[f.index] = res.values;
                  return next;
                });
              } else {
                f.setter(res.values);
              }
            }
          }),
        ]);
      } catch (err) {
        console.error('Failed to fetch picklist values:', err);
      }
    }
    load();
    loadPicklists();
  }, [email, caseId]);

  const handleUpdate = async () => {
    if (isReadOnly) return;
    if (!status.trim()) {
      setError('Please select a Status');
      return;
    }
    if (!rcaReason.trim()) {
      setError('Please select an RCA Reason');
      return;
    }
    if (!rcaComments.trim()) {
      setError('Please enter Resolution Comments');
      return;
    }

    setUpdating(true);
    setError(null);
    try {
      const res = await updateCase(caseId, {
        Status: status,
        feEmail: email?.trim?.() || '', // FE who resolved - used to filter Resolved tab
        RCA_Reason__c: rcaReason,
        RCA_Comments__c: rcaComments,
        Material_Needed__c: materialNeeded,
        ...materials.reduce((acc, curr, i) => {
          const idx = i + 1;
          acc[`Material${idx}__c`] = curr.name;
          acc[`Material_${idx}_Quantity__c`] = curr.quantity;
          return acc;
        }, {}),
        Vendor_Name__c: vendorName,
        Civil_Needed__c: civilNeeded,
        Access_Issue_YES_NO__c: accessIssueYesNo,
        Access_Issue__c: accessIssue,
        Access_Granted__c: accessGranted,
        Access_Granted_Date_Time__c: accessGrantedDateTime,
        Remark_For_Access_Issue__c: remarkForAccessIssue,
        ...restorationUpdates.reduce((acc, curr, i) => {
          const idx = i + 1;
          acc[`Restoration_Update_${idx}__c`] = curr.text;
          acc[`Restoration_Update_${idx}_Date_Time__c`] = curr.dateTime;
          return acc;
        }, {}),
        CE_Team_Acknowledgement__c: ceTeamAcknowledgement,
        Vendor_Splicer_Assigned__c: vendorSplicerAssigned,
        Splicer_Available__c: splicerAlignDateTime,
        Splicer_Acknowledgement__c: splicerAcknowledgement,
        Team_Reached_Time_Mark_On_Site__c: teamReachedTimeMarkOnSite,
        Fault_Identification__c: faultIdentification,
        Fault_Found__c: faultIdentification === 'YES' ? faultFound : '',
        Restoration_Start__c: restorationStart,
        Other_Materials__c: otherMaterials,
        Cable_Start_Reading__c: cableStartReading,
        Cable_ID__c: cableId,
        PPE_Compliance__c: ppeCompliance,
        Cable_End_Reading__c: cableEndReading,
        A_Latlong__c: aEndLatlong,
        B_Latlong__c: bEndLatlong,
        ...vendorUpdates.reduce((acc, curr, i) => {
          const idx = i + 1;
          acc[`Vendor_Update_${idx}__c`] = curr.text;
          acc[`Vendor_Update_${idx}_Date_Time__c`] = curr.dateTime;
          return acc;
        }, {}),
        Check_The_Link_Status_Date_Time__c: checkTheLinkStatusDateTime,
        LEPTON_Network_Id__c: leptonNetworkId,
        Generic_Cause_of_Cable_Cut__c: genericCauseOfCableCut,
        Delay_Reason__c: delayReason,
        Delay_Comments__c: delayComments,
        Laser_Status__c: laserStatus,
        current_Status__c: currentStatusVendor,
      });
      if (res.success) {
        // Check if the status was changed TO resolved vs it was ALREADY resolved
        // Modify this line to handle both cases (Status and status)
        const wasAlreadyResolved = (caseData?.Status || caseData?.status || '').toLowerCase() === 'resolved';
        setSuccess(status.toLowerCase() === 'resolved' && !wasAlreadyResolved ? 'The case has been resolved.' : 'Case updated successfully!');
        //setSuccess(status.toLowerCase() === 'resolved' ? 'The case has been resolved.' : 'Case updated successfully!');
      } else {
        setError(res.message || 'Update failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setUpdating(false);
    }
  };

  const handleBack = () => navigate('/dashboard');
  const handleSuccessClose = () => {
    setSuccess(null);
    // When status changed to Resolved, go to Resolved tab so case appears there with read-only view
    if (status.toLowerCase() === 'resolved') {
      navigate('/dashboard?tab=resolved');
    } else {
      handleBack();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-red-600 mb-4">{error || 'Case not found'}</p>
        <button onClick={handleBack} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const caseNumber = caseData.CaseNumber ?? caseData.caseNumber ?? 'N/A';
  const currentStatus = caseData.Status ?? caseData.status ?? 'Unknown';
  const origin = caseData.Origin ?? caseData.origin ?? 'N/A';

  // LOB: Line of Business - controls which fields to show
  const lob = (caseData.Line_of_Business__c ?? caseData.LOB__c ?? caseData.lineOfBusiness ?? '').trim();
  const lobNormalized = lob.toLowerCase();

  // Helper to get field value
  const getVal = (obj, ...keys) => {
    for (const k of keys) {
      const v = obj[k];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
    return 'N/A';
  };

  // LOB-specific fields
  const siteId = getVal(caseData, 'Site_ID__c', 'siteId');
  const alarmName = getVal(caseData, 'Alarm_Name__c', 'AlarmName__c', 'alarmName');
  const circuitId = getVal(caseData, 'Circuit_ID__c', 'Circuit_Id__c', 'CircuitId__c', 'circuitId');
  const customerCircuitId = getVal(caseData, 'CustomerCircuitId__c', 'Customer_Circuit_Id__c', 'customerCircuitId');
  const consoleId = getVal(caseData, 'Console_Route_ID__c', 'Console_Id__c', 'ConsoleId__c', 'consoleId');
  const lineName = getVal(caseData, 'PathName__c', 'Line_Name__c', 'LineName__c', 'Link_Name__c', 'lineName');
  const gponId = getVal(caseData, 'GPON_ID__c', 'GPONID__c', 'gponId');
  const fatNumber = getVal(caseData, 'FAT_Number__c', 'FATNumber__c', 'fatNumber');
  const customerTid = getVal(caseData, 'Customer_TID__c', 'customerTid');
  const ceCaseNumber = getVal(caseData, 'CECaseNumber__c', 'ceCaseNumber');

  // Site A & Z fields
  const siteAAddress = getVal(caseData, 'SiteAddress__c', 'siteAAddress');
  const siteZAddress = getVal(caseData, 'ZSiteAddress__c', 'siteZAddress');
  const siteALat = getVal(caseData, 'SiteLatitude__c', 'siteALat');
  const siteALong = getVal(caseData, 'SiteLongitude__c', 'siteALong');
  const siteZLat = getVal(caseData, 'SiteZLatitude__c', 'siteZLat');
  const siteZLong = getVal(caseData, 'SiteZLongitude__c', 'siteZLong');

  const isSmallCell = lobNormalized === 'small cell';
  const isOHFC = lobNormalized === 'ohfc';
  const isFTTH = lobNormalized === 'ftth';

  const createdDateRaw = caseData.CreatedDate ?? caseData.createdDate;
  const createdDate = createdDateRaw ? new Date(createdDateRaw) : null;
  const formattedCreatedDate = createdDate
    ? createdDate.toLocaleString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    })
    : 'N/A';

  const getSlaInfo = () => {
    if (!createdDate) return null;
    const now = new Date();
    const target = new Date(createdDate.getTime() + 4 * 60 * 60 * 1000);
    const diffMs = now - target;
    const isOverdue = diffMs > 0;
    const absDiff = Math.abs(diffMs);
    const hours = Math.floor(absDiff / (1000 * 60 * 60));
    const mins = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
    const timeStr = `${hours}:${mins < 10 ? '0' : ''}${mins}`;
    return { label: isOverdue ? `${timeStr} overdue` : `${timeStr} remaining`, isOverdue };
  };
  const slaInfo = getSlaInfo();

  const MATERIAL_NEEDED_OPTIONS = ['YES', 'NO'];
  const YES_NO_OPTIONS = ['YES', 'NO'];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe">
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Success</h3>
            <p className="text-slate-600 mb-6">{success}</p>
            <button
              onClick={handleSuccessClose}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <header className="bg-indigo-100 border-b border-indigo-200 sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-lg hover:bg-indigo-200 transition tap-highlight-none"
          >
            <svg className="w-5 h-5 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-lg font-display font-bold text-indigo-900 flex-1">
            {isReadOnly ? 'Case Details' : 'Update Case Details'}
          </h1>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <h2 className="font-display font-bold text-indigo-600 text-lg sm:text-xl">Case #{caseNumber}</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex items-center gap-2 text-slate-600">
              <span className="font-medium text-slate-500">Current Status:</span> {currentStatus}
            </p>
            <p className="flex items-center gap-2 text-slate-600">
              <span className="font-medium text-slate-500">Origin:</span> {origin}
            </p>
            <p className="flex items-center gap-2 text-slate-600">
              <span className="font-medium text-slate-500">LOB:</span> {lob || 'N/A'}
            </p>
            <p className="flex items-center gap-2 text-slate-600">
              <span className="font-medium text-slate-500">Created Date:</span> {formattedCreatedDate}
            </p>
            {slaInfo && (
              <p className="flex items-center gap-2 text-slate-600">
                <span className="font-medium text-slate-500">SLA (4 Hours):</span>
                <span className={`font-bold ${slaInfo.isOverdue ? 'text-red-600' : 'text-emerald-600'}`}>
                  {slaInfo.label}
                </span>
              </p>
            )}

            <p className="flex items-center gap-2 text-slate-600">
              <span className="font-medium text-slate-500">Customer Ticket ID:</span> {customerTid}
            </p>
            <p className="flex items-center gap-2 text-slate-600">
              <span className="font-medium text-slate-500">CE Case Number:</span> {ceCaseNumber}
            </p>

            {/* Small Cell: Site ID, Alarm Name - hidden for OHFC and FTTH */}
            {(isSmallCell || (!isOHFC && !isFTTH)) && (
              <>
                <p className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium text-slate-500">Site ID:</span> {siteId}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium text-slate-500">Alarm Name:</span> {alarmName}
                </p>
              </>
            )}

            {/* OHFC: Circuit Id, Customer Circuit Id, Console Id, Line Name */}
            {isOHFC && (
              <>
                <p className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium text-slate-500">Circuit Id:</span> {circuitId}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium text-slate-500">Customer Circuit Id:</span> {customerCircuitId}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium text-slate-500">Console Id:</span> {consoleId}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium text-slate-500">Line Name:</span> {lineName}
                </p>
              </>
            )}

            {/* FTTH: GPON ID, FAT Number */}
            {isFTTH && (
              <>
                <p className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium text-slate-500">GPON ID:</span> {gponId}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <span className="font-medium text-slate-500">FAT Number:</span> {fatNumber}
                </p>
              </>
            )}

            <div className="pt-2 border-t border-slate-100 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <p className="flex items-baseline gap-2 text-slate-600">
                  <span className="font-medium text-slate-500 whitespace-nowrap">Site A Address:</span>
                  <span className="truncate" title={siteAAddress}>{siteAAddress}</span>
                </p>
                <p className="flex items-baseline gap-2 text-slate-600">
                  <span className="font-medium text-slate-500 whitespace-nowrap">Site Z Address:</span>
                  <span className="truncate" title={siteZAddress}>{siteZAddress}</span>
                </p>

                <p className="flex items-baseline gap-2 text-slate-600">
                  <span className="font-medium text-slate-500 whitespace-nowrap">Site A Latitude:</span> {siteALat}
                </p>
                <p className="flex items-baseline gap-2 text-slate-600">
                  <span className="font-medium text-slate-500 whitespace-nowrap">Site Z Latitude:</span> {siteZLat}
                </p>

                <p className="flex items-baseline gap-2 text-slate-600">
                  <span className="font-medium text-slate-500 whitespace-nowrap">Site A Longitude:</span> {siteALong}
                </p>
                <p className="flex items-baseline gap-2 text-slate-600">
                  <span className="font-medium text-slate-500 whitespace-nowrap">Site Z Longitude:</span> {siteZLong}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-slate-800 mb-3">
            {isReadOnly ? 'Case RCA & Comments' : 'Update Status & RCA'}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Update Case Status</label>
              <button
                type="button"
                onClick={() => !isReadOnly && setShowStatusSheet(true)}
                disabled={isReadOnly}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between tap-highlight-none disabled:opacity-70"
              >
                <span className={!status ? 'text-slate-400' : ''}>{status || 'Select status'}</span>
                {!isReadOnly && (
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Select RCA Reason</label>
              <button
                type="button"
                onClick={() => !isReadOnly && setShowRcaSheet(true)}
                disabled={isReadOnly}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between tap-highlight-none disabled:opacity-70"
              >
                <span className={`truncate ${!rcaReason ? 'text-slate-400' : ''}`}>{rcaReason || 'Select RCA reason'}</span>
                {!isReadOnly && (
                  <svg className="w-5 h-5 text-slate-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Resolution Comments</label>
              <textarea
                value={rcaComments}
                onChange={(e) => !isReadOnly && setRcaComments(e.target.value)}
                readOnly={isReadOnly}
                placeholder="Enter resolution comments..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
              />
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-slate-800">Customer Updates</h3>
                {visibleUpdates < 10 && !isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setVisibleUpdates(prev => Math.min(10, prev + 1))}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors text-xs font-semibold"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Update
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Access Issue Fields */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-slate-100 pb-4 mb-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Access Issue (YES/NO)</label>
                    <select
                      value={accessIssueYesNo || ''}
                      onChange={(e) => {
                        if (!isReadOnly) {
                          const v = e.target.value;
                          setAccessIssueYesNo(v);
                          if (v !== 'YES') {
                            setAccessIssue('');
                            setAccessGranted('');
                            setAccessGrantedDateTime('');
                          }
                        }
                      }}
                      disabled={isReadOnly}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                    >
                      <option value="">Select</option>
                      {YES_NO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  {accessIssueYesNo === 'YES' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Access Issue (Date/Time)</label>
                        <input
                          type="datetime-local"
                          value={accessIssue || ''}
                          onChange={(e) => !isReadOnly && setAccessIssue(e.target.value)}
                          readOnly={isReadOnly}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Access Granted (YES/NO)</label>
                        <select
                          value={accessGranted || ''}
                          onChange={(e) => {
                            if (!isReadOnly) {
                              const v = e.target.value;
                              setAccessGranted(v);
                              if (v !== 'YES') setAccessGrantedDateTime('');
                            }
                          }}
                          disabled={isReadOnly}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                        >
                          <option value="">Select</option>
                          {YES_NO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                      {accessGranted === 'YES' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Access Granted Date/Time</label>
                          <input
                            type="datetime-local"
                            value={accessGrantedDateTime || ''}
                            onChange={(e) => !isReadOnly && setAccessGrantedDateTime(e.target.value)}
                            readOnly={isReadOnly}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Access Issue Reason</label>
                    <textarea
                      value={remarkForAccessIssue}
                      onChange={(e) => !isReadOnly && setRemarkForAccessIssue(e.target.value)}
                      readOnly={isReadOnly}
                      rows={2}
                      placeholder="Enter access issue reason..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                    />
                  </div>
                </div>

                {restorationUpdates.slice(0, visibleUpdates).map((update, i) => {
                  const idx = i + 1;
                  return (
                    <div key={idx} className={`sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 ${idx > 1 ? 'border-t border-slate-100 pt-4 mt-2' : ''}`}>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Update {idx}</label>
                        <textarea
                          value={update.text}
                          onChange={(e) => {
                            if (!isReadOnly) {
                              const newUpdates = [...restorationUpdates];
                              newUpdates[i].text = e.target.value;
                              setRestorationUpdates(newUpdates);
                            }
                          }}
                          readOnly={isReadOnly}
                          rows={2}
                          placeholder={`Enter customer update ${idx}...`}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Update {idx} Date/Time</label>
                        <input
                          type="datetime-local"
                          value={update.dateTime || ''}
                          onChange={(e) => {
                            if (!isReadOnly) {
                              const newUpdates = [...restorationUpdates];
                              newUpdates[i].dateTime = e.target.value;
                              setRestorationUpdates(newUpdates);
                            }
                          }}
                          readOnly={isReadOnly}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-base font-semibold text-slate-800 mb-3">Vendor Updates</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor Name</label>
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => !isReadOnly && setVendorName(e.target.value)}
                    readOnly={isReadOnly}
                    placeholder="Vendor Name"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Status</label>
                  <button
                    type="button"
                    onClick={() => !isReadOnly && setShowCurrentStatusVendorSheet(true)}
                    disabled={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between tap-highlight-none disabled:opacity-70"
                  >
                    <span className={!currentStatusVendor ? 'text-slate-400' : ''}>
                      {currentStatusVendor || 'Select Current Status'}
                    </span>
                    {!isReadOnly && (
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Civil Needed</label>
                  <select
                    value={civilNeeded || ''}
                    onChange={(e) => {
                      if (!isReadOnly) {
                        const v = e.target.value;
                        setCivilNeeded(v);
                        if (v !== 'YES') setRestorationStart('');
                      }
                    }}
                    disabled={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  >
                    <option value="">Select</option>
                    {YES_NO_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">LEPTON Network Id</label>
                  <input
                    type="text"
                    value={leptonNetworkId}
                    onChange={(e) => !isReadOnly && setLeptonNetworkId(e.target.value)}
                    readOnly={isReadOnly}
                    placeholder="Enter LEPTON Network Id"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">CE Team Acknowledgement</label>
                  <input
                    type="datetime-local"
                    value={ceTeamAcknowledgement || ''}
                    onChange={(e) => !isReadOnly && setCeTeamAcknowledgement(e.target.value)}
                    readOnly={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor Splicer Assigned</label>
                  <textarea
                    value={vendorSplicerAssigned}
                    onChange={(e) => !isReadOnly && setVendorSplicerAssigned(e.target.value)}
                    readOnly={isReadOnly}
                    rows={2}
                    placeholder="Enter vendor splicer assigned..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Splicer Align Date and Time</label>
                  <input
                    type="datetime-local"
                    value={splicerAlignDateTime || ''}
                    onChange={(e) => !isReadOnly && setSplicerAlignDateTime(e.target.value)}
                    readOnly={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Splicer Acknowledgement</label>
                  <input
                    type="datetime-local"
                    value={splicerAcknowledgement || ''}
                    onChange={(e) => !isReadOnly && setSplicerAcknowledgement(e.target.value)}
                    readOnly={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Team Reached Time(Mark On Site)
                  </label>
                  <input
                    type="datetime-local"
                    value={teamReachedTimeMarkOnSite || ''}
                    onChange={(e) => !isReadOnly && setTeamReachedTimeMarkOnSite(e.target.value)}
                    readOnly={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fault Identification</label>
                  <select
                    value={faultIdentification || ''}
                    onChange={(e) => {
                      if (isReadOnly) return;
                      const v = e.target.value;
                      setFaultIdentification(v);
                      if (v !== 'YES') setFaultFound('');
                    }}
                    disabled={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  >
                    <option value="">Select</option>
                    {YES_NO_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {faultIdentification === 'YES' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Fault Found</label>
                    <input
                      type="datetime-local"
                      value={faultFound || ''}
                      onChange={(e) => !isReadOnly && setFaultFound(e.target.value)}
                      readOnly={isReadOnly}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                    />
                  </div>
                )}

                {civilNeeded === 'YES' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Restoration Start</label>
                    <input
                      type="datetime-local"
                      value={restorationStart || ''}
                      onChange={(e) => !isReadOnly && setRestorationStart(e.target.value)}
                      readOnly={isReadOnly}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Other Materials</label>
                  <textarea
                    value={otherMaterials}
                    onChange={(e) => !isReadOnly && setOtherMaterials(e.target.value)}
                    readOnly={isReadOnly}
                    rows={2}
                    placeholder="Enter other materials..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cable Start Reading</label>
                  <textarea
                    value={cableStartReading}
                    onChange={(e) => !isReadOnly && setCableStartReading(e.target.value)}
                    readOnly={isReadOnly}
                    rows={2}
                    placeholder="Enter cable start reading..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cable ID</label>
                  <textarea
                    value={cableId}
                    onChange={(e) => !isReadOnly && setCableId(e.target.value)}
                    readOnly={isReadOnly}
                    rows={2}
                    placeholder="Enter cable ID..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">PPE Compliance</label>
                  <select
                    value={ppeCompliance || ''}
                    onChange={(e) => !isReadOnly && setPpeCompliance(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  >
                    <option value="">Select</option>
                    {YES_NO_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cable End Reading</label>
                  <textarea
                    value={cableEndReading}
                    onChange={(e) => !isReadOnly && setCableEndReading(e.target.value)}
                    readOnly={isReadOnly}
                    rows={2}
                    placeholder="Enter cable end reading..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">A End Latlong</label>
                  <input
                    type="text"
                    value={aEndLatlong}
                    onChange={(e) => !isReadOnly && setAEndLatlong(e.target.value)}
                    readOnly={isReadOnly}
                    placeholder="Enter A end latlong"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">B End Latlong</label>
                  <input
                    type="text"
                    value={bEndLatlong}
                    onChange={(e) => !isReadOnly && setBEndLatlong(e.target.value)}
                    readOnly={isReadOnly}
                    placeholder="Enter B end latlong"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div className="sm:col-span-2 mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-slate-800">Vendor Updates</h3>
                    {visibleVendorUpdates < 10 && !isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setVisibleVendorUpdates(prev => Math.min(10, prev + 1))}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors text-xs font-semibold"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Vendor Update
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {vendorUpdates.slice(0, visibleVendorUpdates).map((update, i) => {
                      const idx = i + 1;
                      return (
                        <div key={idx} className={`sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 ${idx > 1 ? 'border-t border-slate-100 pt-4 mt-2' : ''}`}>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor Update {idx}</label>
                            <textarea
                              value={update.text}
                              onChange={(e) => {
                                if (!isReadOnly) {
                                  const newUpdates = [...vendorUpdates];
                                  newUpdates[i].text = e.target.value;
                                  setVendorUpdates(newUpdates);
                                }
                              }}
                              readOnly={isReadOnly}
                              rows={2}
                              placeholder={`Enter vendor update ${idx}...`}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor Update {idx} Date/Time</label>
                            <input
                              type="datetime-local"
                              value={update.dateTime || ''}
                              onChange={(e) => {
                                if (!isReadOnly) {
                                  const newUpdates = [...vendorUpdates];
                                  newUpdates[i].dateTime = e.target.value;
                                  setVendorUpdates(newUpdates);
                                }
                              }}
                              readOnly={isReadOnly}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Check The Link Status Date/Time
                  </label>
                  <input
                    type="datetime-local"
                    value={checkTheLinkStatusDateTime || ''}
                    onChange={(e) => !isReadOnly && setCheckTheLinkStatusDateTime(e.target.value)}
                    readOnly={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Laser Status</label>
                  <select
                    value={laserStatus || ''}
                    onChange={(e) => !isReadOnly && setLaserStatus(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  >
                    <option value="">Select</option>
                    {YES_NO_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Generic Cause of Cable Cut</label>
                  <button
                    type="button"
                    onClick={() => !isReadOnly && setShowGenericCauseSheet(true)}
                    disabled={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between tap-highlight-none disabled:opacity-70"
                  >
                    <span className={!genericCauseOfCableCut ? 'text-slate-400' : ''}>
                      {genericCauseOfCableCut || 'Select Generic Cause'}
                    </span>
                    {!isReadOnly && (
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Delay Reason</label>
                  <button
                    type="button"
                    onClick={() => !isReadOnly && setShowDelayReasonSheet(true)}
                    disabled={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between tap-highlight-none disabled:opacity-70"
                  >
                    <span className={!delayReason ? 'text-slate-400' : ''}>
                      {delayReason || 'Select Delay Reason'}
                    </span>
                    {!isReadOnly && (
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Delay Comments</label>
                  <textarea
                    value={delayComments}
                    onChange={(e) => !isReadOnly && setDelayComments(e.target.value)}
                    readOnly={isReadOnly}
                    placeholder="Enter delay comments..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Material Needed</label>
                  <select
                    value={materialNeeded || ''}
                    onChange={(e) => !isReadOnly && setMaterialNeeded(e.target.value)}
                    disabled={isReadOnly}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                  >
                    <option value="">Select</option>
                    {MATERIAL_NEEDED_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {materialNeeded === 'YES' && (
                  <div className="sm:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-800">Materials Used</h4>
                      {visibleMaterials < 5 && !isReadOnly && (
                        <button
                          type="button"
                          onClick={() => setVisibleMaterials(prev => Math.min(5, prev + 1))}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors text-xs font-semibold"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Material
                        </button>
                      )}
                    </div>

                    {materials.slice(0, visibleMaterials).map((mat, i) => {
                      const idx = i + 1;
                      return (
                        <div key={idx} className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${idx > 1 ? 'border-t border-slate-100 pt-4 mt-2' : ''}`}>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Material {idx}</label>
                            <button
                              type="button"
                              onClick={() => !isReadOnly && setActiveMaterialIndex(i)}
                              disabled={isReadOnly}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between tap-highlight-none disabled:opacity-70"
                            >
                              <span className={!mat.name ? 'text-slate-400' : ''}>
                                {mat.name || `Select material ${idx}`}
                              </span>
                              {!isReadOnly && (
                                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                              Material {idx} Quantity (meters/nos)
                            </label>
                            <input
                              type="text"
                              value={mat.quantity}
                              onChange={(e) => {
                                if (!isReadOnly) {
                                  const newMats = [...materials];
                                  newMats[i].quantity = e.target.value;
                                  setMaterials(newMats);
                                }
                              }}
                              readOnly={isReadOnly}
                              placeholder="Enter quantity"
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none disabled:opacity-70"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
        )}

        <div className="pt-4">
          {isReadOnly ? (
            <button
              onClick={handleBack}
              className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold tap-highlight-none"
            >
              Back
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleBack}
                className="flex-1 py-3.5 rounded-xl border border-slate-300 text-slate-700 font-semibold tap-highlight-none"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="flex-1 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold tap-highlight-none disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {updating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update'
                )}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Status Bottom Sheet */}
      {showStatusSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowStatusSheet(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 py-4">
              <h3 className="text-lg font-bold text-slate-900">Select Status</h3>
            </div>
            <ul className="p-4 pb-8">
              {STATUS_OPTIONS.map((opt) => (
                <li key={opt}>
                  <button
                    onClick={() => { setStatus(opt); setShowStatusSheet(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-left tap-highlight-none"
                  >
                    {status === opt && (
                      <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={status === opt ? 'font-medium text-indigo-600' : ''}>{opt}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* RCA Bottom Sheet */}
      {showRcaSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowRcaSheet(false)} />
          <div className="relative bg-white rounded-t-2xl max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 py-4">
              <h3 className="text-lg font-bold text-slate-900">Select RCA Reason</h3>
            </div>
            <ul className="p-4 pb-8">
              {rcaOptions.map((opt) => (
                <li key={opt}>
                  <button
                    onClick={() => { setRcaReason(opt); setShowRcaSheet(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-left tap-highlight-none"
                  >
                    {rcaReason === opt && (
                      <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={`text-sm ${rcaReason === opt ? 'font-medium text-indigo-600' : ''}`}>{opt}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {/* Material Selection Sheet */}
      {activeMaterialIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:p-4" onClick={() => setActiveMaterialIndex(null)}>
          <div
            className="w-full bg-white rounded-t-2xl sm:rounded-2xl max-w-lg overflow-hidden animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Select Material {activeMaterialIndex + 1}</h3>
              <button onClick={() => setActiveMaterialIndex(null)} className="p-2 -mr-2 text-slate-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {materialOptions[activeMaterialIndex]?.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    const newMats = [...materials];
                    newMats[activeMaterialIndex].name = opt;
                    setMaterials(newMats);
                    setActiveMaterialIndex(null);
                  }}
                  className={`w-full text-left px-4 py-3.5 rounded-xl transition flex items-center justify-between ${materials[activeMaterialIndex]?.name === opt ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <span>{opt}</span>
                  {materials[activeMaterialIndex]?.name === opt && (
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Generic Cause Selection Sheet */}
      {showGenericCauseSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:p-4" onClick={() => setShowGenericCauseSheet(false)}>
          <div
            className="w-full bg-white rounded-t-2xl sm:rounded-2xl max-w-lg overflow-hidden animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Select Generic Cause</h3>
              <button onClick={() => setShowGenericCauseSheet(false)} className="p-2 -mr-2 text-slate-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {genericCauseOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setGenericCauseOfCableCut(opt);
                    setShowGenericCauseSheet(false);
                  }}
                  className={`w-full text-left px-4 py-3.5 rounded-xl transition flex items-center justify-between ${genericCauseOfCableCut === opt ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <span>{opt}</span>
                  {genericCauseOfCableCut === opt && (
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delay Reason Selection Sheet */}
      {showDelayReasonSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:p-4" onClick={() => setShowDelayReasonSheet(false)}>
          <div
            className="w-full bg-white rounded-t-2xl sm:rounded-2xl max-w-lg overflow-hidden animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Select Delay Reason</h3>
              <button onClick={() => setShowDelayReasonSheet(false)} className="p-2 -mr-2 text-slate-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {delayReasonOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setDelayReason(opt);
                    setShowDelayReasonSheet(false);
                  }}
                  className={`w-full text-left px-4 py-3.5 rounded-xl transition flex items-center justify-between ${delayReason === opt ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <span>{opt}</span>
                  {delayReason === opt && (
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Current Status Vendor Selection Sheet */}
      {showCurrentStatusVendorSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:p-4" onClick={() => setShowCurrentStatusVendorSheet(false)}>
          <div
            className="w-full bg-white rounded-t-2xl sm:rounded-2xl max-w-lg overflow-hidden animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Select Current Status</h3>
              <button onClick={() => setShowCurrentStatusVendorSheet(false)} className="p-2 -mr-2 text-slate-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {currentStatusVendorOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    setCurrentStatusVendor(opt);
                    setShowCurrentStatusVendorSheet(false);
                  }}
                  className={`w-full text-left px-4 py-3.5 rounded-xl transition flex items-center justify-between ${currentStatusVendor === opt ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <span>{opt}</span>
                  {currentStatusVendor === opt && (
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
