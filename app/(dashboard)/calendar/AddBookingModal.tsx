// @ts-nocheck
"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useTheme } from "@/components/ThemeProvider";
import type { Workshop } from "@/types/database";
import { useState } from "react";

interface Props {
  workshop: Workshop;
  defaultDate: Date;
  services: { service?: { id: string; name_is: string; default_duration_minutes: number } | null }[];
  onClose: () => void;
  onSaved: () => void;
}

const HOURS = Array.from({length:14},(_,i)=>i+7); // 07–20
const MINUTES = [0,15,30,45];

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} mín`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} klst`;
  return `${h} klst ${m} mín`;
}

export default function AddBookingModal({ workshop, defaultDate, services, onClose, onSaved }: Props) {
  const supabase = createSupabaseBrowserClient();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const surface = isDark ? "#252525" : "#ffffff";
  const border  = isDark ? "#2e2e2e" : "#e5e7eb";
  const text    = isDark ? "#f4f4f4" : "#111827";
  const muted   = isDark ? "#888"    : "#6b7280";
  const subsurf = isDark ? "#2e2e2e" : "#f9fafb";
  const amber   = isDark ? "#E8A800" : "#F5B301";

  // Date
  const pad = (n: number) => String(n).padStart(2,"0");
  const defaultDateStr = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth()+1)}-${pad(defaultDate.getDate())}`;

  const [dateStr, setDateStr]   = useState(defaultDateStr);
  const [startHour, setStartHour]     = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [durationHours, setDurationHours]   = useState(1);
  const [durationMins, setDurationMins]     = useState(0);

  const [customerName, setCustomerName]   = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPlate, setCustomerPlate] = useState("");
  const [customerCarMake, setCustomerCarMake]   = useState("");
  const [customerCarModel, setCustomerCarModel] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [serviceLabel, setServiceLabel]   = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string|null>(null);

  const totalDurationMins = durationHours * 60 + durationMins;

  const endHour   = Math.floor((startHour * 60 + startMinute + totalDurationMins) / 60) % 24;
  const endMin    = (startHour * 60 + startMinute + totalDurationMins) % 60;
  const endTimeStr = `${pad(endHour)}:${pad(endMin)}`;

  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const found = services.find(s => s.service?.id === serviceId);
    if (found?.service) {
      const mins = found.service.default_duration_minutes;
      setDurationHours(Math.floor(mins/60));
      setDurationMins(mins%60);
      setServiceLabel(found.service.name_is);
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!dateStr) { setError("Veldu dagsetningu."); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Notandi fannst ekki");

      const startTime = new Date(`${dateStr}T${pad(startHour)}:${pad(startMinute)}:00`);

      const { error: insertError } = await (supabase as any)
        .from("bookings_workshop")
        .insert({
          workshop_id: workshop.id,
          user_id: null, car_id: null,
          service_id: selectedServiceId || null,
          service_label: serviceLabel || null,
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          customer_plate: customerPlate.toUpperCase() || null,
          customer_car_make: customerCarMake || null,
          customer_car_model: customerCarModel || null,
          start_time: startTime.toISOString(),
          duration_minutes: totalDurationMins || 60,
          status: "confirmed",
          source: "manual",
          customer_notes: notes || null,
        });

      if (insertError) throw insertError;
      onSaved();
    } catch(e: any) {
      setError(e?.message ?? "Eitthvað fór úrskeiðis");
      setSaving(false);
    }
  };

  const inputStyle = { width:"100%", padding:"9px 12px", borderRadius:10, border:`1px solid ${border}`, background:subsurf, color:text, fontSize:13, outline:"none", boxSizing:"border-box" as const };
  const selectStyle = { padding:"9px 12px", borderRadius:10, border:`1px solid ${border}`, background:subsurf, color:text, fontSize:13, outline:"none", cursor:"pointer" };

  return (
    <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.5)",padding:16}}>
      <div style={{background:surface,borderRadius:20,border:`1px solid ${border}`,width:"100%",maxWidth:460,maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:`1px solid ${border}`}}>
          <h2 style={{fontSize:17,fontWeight:700,margin:0,color:text}}>Handvirk bókun</h2>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:9,border:`1px solid ${border}`,background:subsurf,color:muted,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>

        <div style={{overflowY:"auto",flex:1,padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>

          {/* Date */}
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:muted,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Dagsetning <span style={{color:"#ef4444"}}>*</span></label>
            <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} style={inputStyle} />
          </div>

          {/* Start time — hour + minute dropdowns */}
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:muted,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Byrjunartími <span style={{color:"#ef4444"}}>*</span></label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <select value={startHour} onChange={e=>setStartHour(Number(e.target.value))} style={selectStyle}>
                {HOURS.map(h => <option key={h} value={h}>{pad(h)}</option>)}
              </select>
              <span style={{color:muted,fontWeight:700}}>:</span>
              <select value={startMinute} onChange={e=>setStartMinute(Number(e.target.value))} style={selectStyle}>
                {MINUTES.map(m => <option key={m} value={m}>{pad(m)}</option>)}
              </select>
              <span style={{color:muted,fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>→ {endTimeStr}</span>
            </div>
          </div>

          {/* Duration — hours + minutes */}
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:muted,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Lengd</label>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <select value={durationHours} onChange={e=>setDurationHours(Number(e.target.value))} style={selectStyle}>
                  {Array.from({length:9},(_,i)=>i).map(h=><option key={h} value={h}>{h === 0 ? '0 klst' : h === 1 ? '1 klst' : `${h} klst`}</option>)}
                </select>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:4}}>
                <select value={durationMins} onChange={e=>setDurationMins(Number(e.target.value))} style={selectStyle}>
                  {MINUTES.map(m=><option key={m} value={m}>{m === 0 ? '0 mín' : `${m} mín`}</option>)}
                </select>
              </div>
              <span style={{color:amber,fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{formatDuration(totalDurationMins)}</span>
            </div>
          </div>

          {/* Service */}
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:muted,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Þjónusta</label>
            <select value={selectedServiceId} onChange={e=>handleServiceChange(e.target.value)} style={{...inputStyle,cursor:"pointer"}}>
              <option value="">Veldu þjónustu...</option>
              {services.map(s => s.service && (
                <option key={s.service.id} value={s.service.id}>{s.service.name_is}</option>
              ))}
            </select>
            {!selectedServiceId && (
              <input type="text" value={serviceLabel} onChange={e=>setServiceLabel(e.target.value)} placeholder="Eða skrifaðu þjónustuheiti handvirkt" style={{...inputStyle,marginTop:6}} />
            )}
          </div>

          {/* Customer info */}
          <div style={{borderTop:`1px solid ${border}`,paddingTop:12}}>
            <p style={{fontSize:10,fontWeight:700,color:muted,textTransform:"uppercase",letterSpacing:"0.5px",margin:"0 0 10px"}}>Viðskiptavinur (valfrjálst)</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {label:"Nafn",value:customerName,setter:setCustomerName,placeholder:"T.d. Jón Jónsson"},
                {label:"Símanúmer",value:customerPhone,setter:setCustomerPhone,placeholder:"T.d. 555-1234"},
                {label:"Bílnúmer",value:customerPlate,setter:setCustomerPlate,placeholder:"T.d. ABC-12"},
              ].map(({label,value,setter,placeholder})=>(
                <div key={label}>
                  <label style={{display:"block",fontSize:11,fontWeight:600,color:muted,marginBottom:4}}>{label}</label>
                  <input type="text" value={value} onChange={e=>setter(e.target.value)} placeholder={placeholder} style={inputStyle} />
                </div>
              ))}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <div>
                  <label style={{display:"block",fontSize:11,fontWeight:600,color:muted,marginBottom:4}}>Tegund</label>
                  <input type="text" value={customerCarMake} onChange={e=>setCustomerCarMake(e.target.value)} placeholder="T.d. Toyota" style={inputStyle} />
                </div>
                <div>
                  <label style={{display:"block",fontSize:11,fontWeight:600,color:muted,marginBottom:4}}>Módel</label>
                  <input type="text" value={customerCarModel} onChange={e=>setCustomerCarModel(e.target.value)} placeholder="T.d. Corolla" style={inputStyle} />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:muted,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>Athugasemdir</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="T.d. Bremsur, viðskiptavinur hringdi..." style={{...inputStyle,resize:"none"}} />
          </div>

          {error && <div style={{padding:"10px 12px",borderRadius:10,background:isDark?"rgba(239,68,68,0.1)":"#fef2f2",border:`1px solid ${isDark?"rgba(239,68,68,0.3)":"#fecaca"}`,color:isDark?"#fca5a5":"#dc2626",fontSize:13,fontWeight:500}}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{padding:"12px 20px 16px",borderTop:`1px solid ${border}`,display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:"11px 0",borderRadius:12,border:`1px solid ${border}`,background:"transparent",color:muted,fontSize:13,fontWeight:600,cursor:"pointer"}}>Hætta við</button>
          <button onClick={handleSave} disabled={saving||!dateStr} style={{flex:2,padding:"11px 0",borderRadius:12,border:"none",background:amber,color:"#111",fontSize:13,fontWeight:700,cursor:"pointer",opacity:saving||!dateStr?0.6:1}}>
            {saving?"Vista...":"Vista bókun"}
          </button>
        </div>
      </div>
    </div>
  );
}
