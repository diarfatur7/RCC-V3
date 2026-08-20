const SUPABASE_URL="https://ewcxhcuapsxrdxcphjlt.supabase.co";
const SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3hoY3VhcHN4cmR4Y3Boamx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0ODEzNTgsImV4cCI6MjEwMjA1NzM1OH0.OblGLWeWrmV1ejB42yhVtyS2w-KL0beBOVKHSh_mjBk";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
const titles={dashboard:"Dashboard",search:"Search",dokumen:"Dokumen",visual:"Visual Center",box:"Box",pvdetail:"Detail PV",request:"Request",reject:"Reject"};
const $=id=>document.getElementById(id);
const esc=v=>String(v??"-").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const field=(a,b)=>`<div class="field"><label>${a}</label><b>${esc(b)}</b></div>`;

function show(page){
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active-page"));
 $(page).classList.add("active-page");
 document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
 $("pageTitle").textContent=titles[page]||page;
 document.querySelector(".sidebar").classList.remove("open");
 if(page==="visual")loadVisualCenter();
 if(page==="request")loadRequests();
 if(page==="reject")loadRejects();
}
document.querySelectorAll(".nav").forEach(x=>x.onclick=()=>show(x.dataset.page));
document.querySelectorAll("[data-goto]").forEach(x=>x.onclick=()=>show(x.dataset.goto));
$("menu").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");

async function loadStats(){
 const {data,error}=await db.rpc("rcc_stats");
 if(error){console.error(error);return}
 const x=data?.[0];if(!x)return;
 $("sTotal").textContent=Number(x.total_dokumen).toLocaleString("id-ID");
 $("sLinked").textContent=Number(x.sudah_terhubung).toLocaleString("id-ID");
 $("sUnlinked").textContent=Number(x.belum_terhubung).toLocaleString("id-ID");
 $("sBox").textContent=Number(x.total_box).toLocaleString("id-ID");
}

async function search(){
 const term=$("q").value.trim();
 if(!term){$("searchResults").innerHTML='<div class="empty">Masukkan kata pencarian.</div>';return}
 $("go").disabled=true;
 const {data,error}=await db.rpc("search_rcc",{search_term:term});
 $("go").disabled=false;
 if(error){$("searchResults").innerHTML=`<div class="empty error">${esc(error.message)}</div>`;return}
 if(!data?.length){$("searchResults").innerHTML='<div class="empty">Tidak ada data ditemukan.</div>';return}
 $("searchResults").innerHTML=data.map(r=>`<article class="card"><div class="head"><div><div class="pv click-pv" style="cursor:pointer" onclick="openPV('${esc(r.nomor_pv)}')">PV ${esc(r.nomor_pv)}</div><div class="vendor">${esc(r.nama_vendor)}</div></div><div class="badge">${esc(r.status_box||"BOX BELUM TERSEDIA")}</div></div><div class="grid">${field("Tahun",r.tahun)}${field("Box",r.nomor_box)}${field("Rak",r.rak)}${field("Lemari",r.lemari)}${field("Kode",r.kode)}</div></article>`).join("");
}
$("go").onclick=search;$("q").onkeydown=e=>{if(e.key==="Enter")search()};

async function searchBox(){
 const term=$("boxQ").value.trim();
 if(!term){$("boxResults").innerHTML='<div class="empty">Masukkan nomor Box, Rak, atau Lemari.</div>';return}
 $("boxResults").innerHTML='<div class="empty">Memuat Box...</div>';
 const {data,error}=await db.rpc("rcc_box_list",{p_search:term});
 if(error){$("boxResults").innerHTML=`<div class="empty error">${esc(error.message)}</div>`;return}
 if(!data?.length){$("boxResults").innerHTML='<div class="empty">Box tidak ditemukan.</div>';return}
 $("boxResults").innerHTML=data.map(b=>`<article class="card"><div class="head"><div><div class="box-title">BOX ${esc(b.nomor_box)}</div><div class="box-meta">Rak ${esc(b.rak)} · Lemari ${esc(b.lemari)} · Roll O Pack ${esc(b.roll_o_pack)}</div></div><div class="badge">${esc(b.status_box||"-")} · ${Number(b.jumlah_dokumen).toLocaleString("id-ID")} dokumen</div></div><div class="box-actions" style="margin-top:12px"><button class="mini" onclick="viewBox(${Number(b.box_id)},'${esc(b.nomor_box)}')">📄 Lihat Isi Box</button></div></article>`).join("");
}
$("boxGo").onclick=searchBox;$("boxQ").onkeydown=e=>{if(e.key==="Enter")searchBox()};

const modal=$("docModal"),form=$("docForm"),boxSelect=$("fBox"),dup=$("duplicateBox");
async function openDocModal(){
 modal.classList.add("show");dup.classList.remove("show");
 const {data,error}=await db.rpc("rcc_box_options");
 if(error){dup.textContent=error.message;dup.classList.add("show");return}
 boxSelect.innerHTML='<option value="">— Belum terhubung —</option>'+data.map(b=>`<option value="${b.box_id}">Box ${esc(b.nomor_box)} · Rak ${esc(b.rak)} · Lemari ${esc(b.lemari)}</option>`).join("");
}
$("addDocBtn").onclick=openDocModal;$("closeModal").onclick=()=>modal.classList.remove("show");$("cancelDoc").onclick=()=>modal.classList.remove("show");
modal.onclick=e=>{if(e.target===modal)modal.classList.remove("show")};
form.onsubmit=async e=>{
 e.preventDefault();const btn=form.querySelector("button.primary");btn.disabled=true;btn.textContent="Menyimpan...";
 const {data,error}=await db.rpc("add_rcc_document",{p_nomor_pv:$("fPv").value.trim(),p_nama_vendor:$("fVendor").value.trim(),p_tahun:Number($("fYear").value),p_kode:$("fKode").value.trim(),p_box_id:boxSelect.value?Number(boxSelect.value):null});
 btn.disabled=false;btn.textContent="Simpan";
 if(error){dup.textContent=error.message;dup.classList.add("show");return}
 if(!data?.ok){dup.textContent=data.message;dup.classList.add("show");return}
 modal.classList.remove("show");form.reset();loadStats();alert("Dokumen berhasil ditambahkan.");
};

/* CSV */
const csvModal=$("csvModal"),csvFile=$("csvFile"),csvPreview=$("csvPreview"),csvProgress=$("csvProgress"),startCsv=$("startCsv");
$("csvBtn").onclick=()=>{csvModal.classList.add("show");csvFile.value="";csvPreview.innerHTML="";csvProgress.textContent="";startCsv.disabled=true};
$("closeCsv").onclick=()=>csvModal.classList.remove("show");$("cancelCsv").onclick=()=>csvModal.classList.remove("show");
function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');let rows=[],row=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){let c=text[i],n=text[i+1];if(c==='"'){if(quoted&&n==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=""}else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&n==="\n")i++;row.push(cell);cell="";if(row.some(v=>v.trim()))rows.push(row);row=[]}else cell+=c}
 if(cell!==""||row.length){row.push(cell);if(row.some(v=>v.trim()))rows.push(row)}
 if(!rows.length)return [];
 const headers=rows[0].map(x=>x.trim().toLowerCase().replace(/\s+/g,"_"));
 return rows.slice(1).map((r,i)=>{let o={_row:i+2};headers.forEach((h,j)=>o[h]=(r[j]??"").trim());return o});
}
let csvRows=[];
csvFile.onchange=async()=>{csvRows=parseCSV(await csvFile.files[0].text());if(!csvRows.length){csvPreview.innerHTML='<div class="empty error">CSV kosong.</div>';return}
 const missing=["nomor_pv","nama_vendor","tahun"].filter(k=>!(k in csvRows[0]));if(missing.length){csvPreview.innerHTML='<div class="empty error">Kolom wajib: '+missing.join(", ")+'</div>';return}
 csvPreview.innerHTML=`<b>${csvRows.length.toLocaleString("id-ID")} baris siap diimport.</b>`;startCsv.disabled=false};
startCsv.onclick=async()=>{startCsv.disabled=true;let ins=0,dup=0,bad=0,err=0;for(let i=0;i<csvRows.length;i+=300){let batch=csvRows.slice(i,i+300).map(r=>({nomor_pv:r.nomor_pv,nama_vendor:r.nama_vendor,tahun:r.tahun,kode:r.kode||"",nomor_box:r.nomor_box||""}));csvProgress.textContent=`Mengimport ${Math.min(i+batch.length,csvRows.length).toLocaleString("id-ID")} / ${csvRows.length.toLocaleString("id-ID")}...`;let {data,error}=await db.rpc("import_rcc_documents",{p_rows:batch});if(error){csvProgress.textContent="Gagal: "+error.message;startCsv.disabled=false;return}ins+=Number(data?.inserted||0);dup+=Number(data?.duplicates||0);bad+=Number(data?.invalid||0);err+=Number(data?.errors||0)}csvProgress.innerHTML=`<b>Selesai.</b> Ditambahkan: ${ins.toLocaleString("id-ID")} · Duplikat: ${dup.toLocaleString("id-ID")} · Tidak valid: ${bad.toLocaleString("id-ID")} · Error: ${err.toLocaleString("id-ID")}`;startCsv.disabled=false;loadStats()};

/* BULK PASTE */
const pasteModal=$("pasteModal"),pasteArea=$("pasteArea"),pastePreview=$("pastePreview"),pasteProgress=$("pasteProgress"),checkPaste=$("checkPaste"),importPaste=$("importPaste");
let pasteRows=[],pasteChecked=false;
$("pasteBtn").onclick=()=>{pasteModal.classList.add("show");pasteArea.value="";pastePreview.innerHTML="";pasteProgress.textContent="";checkPaste.disabled=true;importPaste.disabled=true;pasteRows=[];pasteChecked=false;pasteArea.focus()};
$("closePaste").onclick=()=>pasteModal.classList.remove("show");$("cancelPaste").onclick=()=>pasteModal.classList.remove("show");
function parsePasted(text){return text.replace(/\r/g,"").split("\n").filter(x=>x.trim()).map((line,i)=>{let c=line.split("\t");if(c.length===1&&line.includes(";"))c=line.split(";");return{_row:i+1,nomor_pv:(c[0]||"").trim(),nama_vendor:(c[1]||"").trim(),tahun:(c[2]||"").trim(),kode:(c[3]||"").trim(),nomor_box:(c[4]||"").trim()}})}
pasteArea.oninput=()=>{pasteRows=parsePasted(pasteArea.value);checkPaste.disabled=!pasteRows.length;importPaste.disabled=true;pasteChecked=false;pasteProgress.textContent=pasteRows.length?`${pasteRows.length.toLocaleString("id-ID")} baris terdeteksi.`:""};
checkPaste.onclick=async()=>{checkPaste.disabled=true;pasteProgress.textContent="Memeriksa data...";let results=[];for(let i=0;i<pasteRows.length;i+=300){let {data,error}=await db.rpc("check_rcc_documents",{p_rows:pasteRows.slice(i,i+300)});if(error){pasteProgress.textContent="Gagal: "+error.message;checkPaste.disabled=false;return}results.push(...(data||[]))}pasteRows=results;let ok=results.filter(r=>r.status==="READY").length,dup=results.filter(r=>r.status==="DUPLICATE").length,bad=results.length-ok-dup;pastePreview.innerHTML=`<div><b>${results.length}</b> baris · <span class="ok-text">${ok} siap</span> · <span class="warn-text">${dup} duplikat</span> · <span class="bad-text">${bad} tidak valid</span></div><table><thead><tr><th>PV</th><th>Vendor</th><th>Tahun</th><th>Kode</th><th>Box</th><th>Status</th></tr></thead><tbody>${results.slice(0,100).map(r=>`<tr><td>${esc(r.nomor_pv)}</td><td>${esc(r.nama_vendor)}</td><td>${esc(r.tahun)}</td><td>${esc(r.kode)}</td><td>${esc(r.nomor_box)}</td><td>${esc(r.status)} — ${esc(r.message)}</td></tr>`).join("")}</tbody></table>`;pasteProgress.textContent=results.length>100?"Preview 100 baris pertama.":"";importPaste.disabled=ok===0;checkPaste.disabled=false;pasteChecked=true};
importPaste.onclick=async()=>{let ready=pasteRows.filter(r=>r.status==="READY").map(r=>({nomor_pv:r.nomor_pv,nama_vendor:r.nama_vendor,tahun:r.tahun,kode:r.kode,nomor_box:r.nomor_box}));if(!ready.length)return;importPaste.disabled=true;let ins=0;for(let i=0;i<ready.length;i+=300){pasteProgress.textContent=`Menyimpan ${Math.min(i+300,ready.length).toLocaleString("id-ID")} / ${ready.length.toLocaleString("id-ID")}...`;let {data,error}=await db.rpc("import_rcc_documents",{p_rows:ready.slice(i,i+300)});if(error){pasteProgress.textContent=error.message;importPaste.disabled=false;return}ins+=Number(data?.inserted||0)}pasteProgress.innerHTML=`<b>Selesai.</b> ${ins.toLocaleString("id-ID")} dokumen berhasil ditambahkan.`;loadStats()};

/* BOX DETAIL */
let currentBoxId=null,currentBoxNumber=null,currentBoxRows=[];
async function viewBox(id,number){currentBoxId=id;currentBoxNumber=number;$("boxResults").innerHTML='<div class="empty">Memuat isi Box...</div>';let {data,error}=await db.rpc("rcc_box_documents",{p_box_id:id});if(error){$("boxResults").innerHTML=`<div class="empty error">${esc(error.message)}</div>`;return}currentBoxRows=data||[];renderBoxDetail()}
function renderBoxDetail(){let term=($("insideBoxSearch")?.value||"").toLowerCase().trim();let rows=currentBoxRows.filter(r=>!term||[r.nomor_pv,r.nama_vendor,r.tahun,r.kode].some(v=>String(v??"").toLowerCase().includes(term)));$("boxResults").innerHTML=`<button class="mini" onclick="searchBox()">← Kembali</button><div class="card" style="margin-top:12px"><div class="head"><div><div class="box-title">BOX ${esc(currentBoxNumber)}</div><div class="box-meta">${currentBoxRows.length.toLocaleString("id-ID")} dokumen</div></div><div class="header-actions"><button class="mini" onclick="printCurrentBox()">🖨 Cetak</button><button class="mini" onclick="qrCurrentBox()">▣ QR Box</button></div></div><div class="inside-box-tools"><input id="insideBoxSearch" placeholder="Cari PV, vendor, tahun, atau kode..." value="${esc(term)}"><span>${rows.length.toLocaleString("id-ID")} hasil</span></div><div class="doc-list">${rows.length?rows.map(d=>`<div class="doc-row" style="cursor:pointer" onclick="openPV('${esc(d.nomor_pv)}')"><b>${esc(d.nomor_pv)}</b><span>${esc(d.nama_vendor)}</span><span>${esc(d.tahun)}</span><span>${esc(d.kode)}</span></div>`).join(""):'<div class="empty">Data tidak ditemukan di Box ini.</div>'}</div></div>`;if($("insideBoxSearch"))$("insideBoxSearch").oninput=renderBoxDetail}
function printCurrentBox(){let win=window.open("","_blank");if(!win)return;win.document.write(`<html><head><title>Isi Box ${esc(currentBoxNumber)}</title><style>body{font-family:Arial;padding:30px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:7px}</style></head><body><h1>BOX ${esc(currentBoxNumber)}</h1><p>${currentBoxRows.length} dokumen</p><table><tr><th>No</th><th>PV</th><th>Vendor</th><th>Tahun</th><th>Kode</th></tr>${currentBoxRows.map((d,i)=>`<tr><td>${i+1}</td><td>${esc(d.nomor_pv)}</td><td>${esc(d.nama_vendor)}</td><td>${esc(d.tahun)}</td><td>${esc(d.kode)}</td></tr>`).join("")}</table><script>onload=()=>print()<\/script></body></html>`);win.document.close()}
function qrCurrentBox(){let base=prompt("Masukkan URL RCC yang bisa dibuka dari HP:",location.href.split("?")[0]);if(!base)return;let url=base.replace(/\/+$/,"")+"?box="+encodeURIComponent(currentBoxId);let win=window.open("","_blank");if(!win)return;win.document.write(`<html><head><title>QR Box ${esc(currentBoxNumber)}</title><script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script></head><body style="text-align:center;font-family:Arial;padding:30px"><h2>BOX ${esc(currentBoxNumber)}</h2><div id="qr"></div><script>new QRCode(document.getElementById('qr'),{text:${JSON.stringify(url)},width:260,height:260})<\/script></body></html>`);win.document.close()}

/* ADD BOX */
const boxModal=$("boxModal"),boxForm=$("boxForm"),boxMsg=$("boxMsg");
$("addBoxBtn").onclick=()=>boxModal.classList.add("show");$("closeBox").onclick=()=>boxModal.classList.remove("show");$("cancelBox").onclick=()=>boxModal.classList.remove("show");
boxForm.onsubmit=async e=>{e.preventDefault();let {data,error}=await db.rpc("add_rcc_box",{p_nomor_box:$("bNomor").value,p_roll_o_pack:$("bRoll").value,p_rak:$("bRak").value,p_lemari:$("bLemari").value,p_status:$("bStatus").value});if(error){boxMsg.textContent=error.message;boxMsg.classList.add("show");return}if(!data?.ok){boxMsg.textContent=data.message;boxMsg.classList.add("show");return}boxModal.classList.remove("show");boxForm.reset();loadStats();$("boxQ").value=data.nomor_box;searchBox()};

/* PV DETAIL */
async function openPV(pv){show("pvdetail");$("pvDetailResults").innerHTML='<div class="empty">Memuat detail PV...</div>';let {data,error}=await db.rpc("rcc_pv_detail",{p_search:pv});if(error){$("pvDetailResults").innerHTML=`<div class="empty error">${esc(error.message)}</div>`;return}if(!data?.length){$("pvDetailResults").innerHTML='<div class="empty">PV tidak ditemukan.</div>';return}let f=data[0];$("pvDetailResults").innerHTML=`<div class="detail-hero"><div class="pv">PV ${esc(f.nomor_pv)}</div><div class="vendor">${esc(f.nama_vendor)}</div><div class="grid">${field("Tahun",f.tahun)}${field("Jumlah Record",data.length)}${field("Kode",f.kode)}${field("Box",f.nomor_box)}${field("Status",f.status||"")}</div></div>${data.map((r,i)=>`<article class="card"><div class="head"><b>Record #${i+1}</b><div class="badge">${esc(r.status||"BELUM ADA BOX")}</div></div><div class="grid" style="margin-top:12px">${field("Box",r.nomor_box)}${field("Rak",r.rak)}${field("Lemari",r.lemari)}${field("Roll O Pack",r.roll_o_pack)}${field("Kode",r.kode)}</div></article>`).join("")}`}
$("backPv").onclick=()=>show("search");

/* VISUAL */
let visualRows=[],selectedCabinet=null;
async function loadVisualCenter(){let {data,error}=await db.rpc("rcc_visual_center");if(error){$("cabinetGrid").innerHTML=`<div class="empty error">${esc(error.message)}</div>`;return}visualRows=data||[];renderVisual()}
function renderVisual(){let q=($("visualSearch").value||"").toLowerCase().trim(),st=$("visualStatus").value,rows=visualRows.filter(r=>{let hay=[r.lemari,r.rak,r.nomor_box].join(" ").toLowerCase(),status=Number(r.jumlah_dokumen)>0?"TERISI":"KOSONG";return(!q||hay.includes(q))&&(!st||st===status)}),cabs=[...new Set(rows.map(r=>String(r.lemari||"").trim()).filter(Boolean))],filled=rows.filter(r=>Number(r.jumlah_dokumen)>0).length;$("visualSummary").innerHTML=`<div class="visual-stat"><span>LEMARI</span><b>${cabs.length}</b></div><div class="visual-stat"><span>BOX</span><b>${rows.length}</b></div><div class="visual-stat"><span>BOX TERISI</span><b>${filled}</b></div><div class="visual-stat"><span>BOX KOSONG</span><b>${rows.length-filled}</b></div>`;$("cabinetGrid").innerHTML=cabs.map(c=>{let cr=rows.filter(r=>String(r.lemari).trim()===c),fc=cr.filter(r=>Number(r.jumlah_dokumen)>0).length;return`<div class="cabinet-card" onclick="showCabinet('${esc(c)}')"><div class="cabinet-name">LEMARI ${esc(c)}</div><div class="cabinet-meta">${cr.length} Box · ${fc} terisi</div><div class="cabinet-bars">${cr.slice(0,24).map(r=>`<span class="cabinet-bar ${Number(r.jumlah_dokumen)>0?'filled':''}"></span>`).join("")}</div><div class="cabinet-percent">${cr.length?Math.round(fc/cr.length*100):0}% terisi</div></div>`}).join("");if(!rows.length)$("cabinetGrid").innerHTML='<div class="empty">Tidak ada lokasi.</div>'}
function showCabinet(c){let rows=visualRows.filter(r=>String(r.lemari).trim()===String(c).trim()),racks=[...new Set(rows.map(r=>String(r.rak||"").trim()).filter(Boolean))];$("cabinetDetail").innerHTML=`<div class="section-head"><div><h2>LEMARI ${esc(c)}</h2><p>${rows.length} Box · ${racks.length} Rak</p></div></div>`+racks.map(r=>{let bs=rows.filter(x=>String(x.rak).trim()===r);return`<div class="rack-card"><div class="rack-head"><b>RAK ${esc(r)}</b><span>${bs.filter(x=>Number(x.jumlah_dokumen)>0).length}/${bs.length} terisi</span></div><div class="box-grid">${bs.map(b=>`<div class="visual-box ${Number(b.jumlah_dokumen)>0?'filled':''}" onclick="viewBox(${b.box_id},'${esc(b.nomor_box)}')"><strong>${esc(b.nomor_box)}</strong><small>${Number(b.jumlah_dokumen)} PV</small></div>`).join("")}</div></div>`}).join("")}
$("refreshVisual").onclick=loadVisualCenter;$("visualSearch").oninput=renderVisual;$("visualStatus").onchange=renderVisual;

/* REQUEST */
async function loadRequests(){let {data,error}=await db.rpc("rcc_request_list",{p_search:$("requestSearch").value||"",p_status:""});if(error){$("requestResults").innerHTML=`<div class="empty error">${esc(error.message)}</div>`;return}$("requestResults").innerHTML=(data||[]).map(r=>`<article class="card"><div class="head"><div><b>${esc(r.payment_voucher)}</b><div class="vendor">${esc(r.vendor)} · ${esc(r.user_name)}</div></div><div class="badge">${esc(r.status)}</div></div><div class="grid">${field("Kode",r.kode)}${field("Dibuat",new Date(r.created_at).toLocaleString("id-ID"))}${field("Catatan",r.notes)}</div></article>`).join("")||'<div class="empty">Belum ada request.</div>'}
$("requestGo").onclick=loadRequests;$("addRequestBtn").onclick=()=>$("requestModal").classList.add("show");$("closeRequest").onclick=()=>$("requestModal").classList.remove("show");$("cancelRequest").onclick=()=>$("requestModal").classList.remove("show");
$("requestForm").onsubmit=async e=>{e.preventDefault();let {data,error}=await db.rpc("rcc_request_create",{p_user_name:$("rUser").value,p_payment_voucher:$("rPv").value,p_kode:$("rKode").value,p_vendor:$("rVendor").value,p_notes:$("rNotes").value});if(error){alert(error.message);return}if(data?.ok){$("requestModal").classList.remove("show");e.target.reset();loadRequests()}};

/* REJECT */
async function loadRejects(){let {data,error}=await db.rpc("rcc_reject_list",{p_search:$("rejectSearch").value||"",p_status:""});if(error){$("rejectResults").innerHTML=`<div class="empty error">${esc(error.message)}</div>`;return}$("rejectResults").innerHTML=(data||[]).map(r=>`<article class="card"><div class="head"><div><b>${esc(r.nomor_pv)}</b><div class="vendor">${esc(r.nama_vendor)}</div></div><div class="badge">${esc(r.status)}</div></div><div class="grid">${field("Tanggal",r.tanggal_reject)}${field("Reviewer",r.reviewer||r.user_reject)}${field("Alasan",r.alasan)}${field("Box",r.nomor_box)}${field("Rak",r.rak)}</div></article>`).join("")||'<div class="empty">Belum ada reject.</div>'}
$("rejectGo").onclick=loadRejects;$("addRejectBtn").onclick=()=>{$("jDate").value=new Date().toISOString().slice(0,10);$("rejectModal").classList.add("show")};$("closeReject").onclick=()=>$("rejectModal").classList.remove("show");$("cancelReject").onclick=()=>$("rejectModal").classList.remove("show");
$("rejectForm").onsubmit=async e=>{e.preventDefault();let {data,error}=await db.rpc("rcc_create_reject_manual",{p_tanggal:$("jDate").value,p_nama_vendor:$("jVendor").value,p_user:$("jUser").value,p_alasan:$("jReason").value,p_nomor_pv:$("jPv").value||null});if(error){alert(error.message);return}if(data?.ok){$("rejectModal").classList.remove("show");e.target.reset();loadRejects()}};

/* QR AUTO OPEN */
async function openBoxFromUrl(){let p=new URLSearchParams(location.search).get("box");if(!p)return;show("box");if(/^\d+$/.test(p)){let {data}=await db.rpc("rcc_box_list",{p_search:""});let b=(data||[]).find(x=>String(x.box_id)===String(p));if(b){viewBox(b.box_id,b.nomor_box);return}}$("boxQ").value=p;searchBox()}
openBoxFromUrl();loadStats();


/* PREMIUM THEME */
(function(){
  const themeBtn = document.getElementById("themeToggle");
  if(!themeBtn) return;
  const saved = localStorage.getItem("rcc_theme");
  if(saved === "dark") document.body.classList.add("dark");
  function sync(){
    const dark = document.body.classList.contains("dark");
    themeBtn.innerHTML = dark ? "☀ <span>Light Mode</span>" : "☾ <span>Dark Mode</span>";
  }
  themeBtn.addEventListener("click", function(){
    document.body.classList.toggle("dark");
    localStorage.setItem("rcc_theme", document.body.classList.contains("dark") ? "dark" : "light");
    sync();
  });
  sync();
})();
