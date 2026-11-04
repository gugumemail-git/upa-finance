        // ==========================================
        // FIREBASE CONFIGURATION
        // ==========================================
        const firebaseConfig = {
        apiKey: "AIzaSyCHkvx8b-bVjdCiCEXWVRjkPJnsxufYjvs",
        authDomain: "upa-finance.firebaseapp.com",
        projectId: "upa-finance",
        storageBucket: "upa-finance.firebasestorage.app",
        messagingSenderId: "676144093078",
        appId: "1:676144093078:web:7a6cbca5989fa644ccafb7",
        measurementId: "G-2X5J5NMHR2"
        };
        firebase.initializeApp(firebaseConfig);
        const firebaseAuth = firebase.auth();
        const firebaseDb = firebase.firestore();
        const cloudDocRef = firebaseDb.collection('upaFinance').doc('main');
        const FIREBASE_EDITOR_EMAIL = 'upafinance@gmail.com'; 
        const LOCAL_STORE_KEY = 'UPA_3216M010_SHOPEE_SIDEBAR';
        
        let cloudUnsubscribe = null;
        let cloudSyncReady = false;
        let lastCloudSerialized = '';
        let cloudSaveTimer = null;
        let appInitialized = false;
        const CLOUD_SAVE_DELAY_MS = 600;

        // ==========================================
        // AUTH MANAGER
        // ==========================================
        function isAuthorizedEditor(user) {
            const account = user || firebaseAuth.currentUser;
            return !!account && typeof account.email === 'string' &&
                account.email.trim().toLowerCase() === FIREBASE_EDITOR_EMAIL.trim().toLowerCase();
        }
        function isEditor() { return isAuthorizedEditor(firebaseAuth.currentUser); }
        function applyAuthUI() {
            const editor = isEditor();
            document.body.classList.toggle('readonly', !editor);

            const badge = document.getElementById('modeBadge');
            if (badge) {
                badge.textContent = editor ? 'Editor' : 'Mode Lihat';
                badge.className = editor
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full uppercase'
                    : 'bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase';
            }

            const btn = document.getElementById('authBtn');
            const label = document.getElementById('authBtnLabel');
            if (btn && label) {
                if (editor) {
                    label.textContent = 'Logout';
                    btn.className = 'bg-slate-700 hover:bg-slate-900 text-white text-xs px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 shadow-md';
                    const ic = btn.querySelector('i'); if (ic) ic.className = 'fa-solid fa-right-from-bracket';
                } else {
                    label.textContent = 'Login Editor';
                    btn.className = 'bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm';
                    const ic = btn.querySelector('i'); if (ic) ic.className = 'fa-solid fa-right-to-bracket';
                }
            }
        }
        async function onAuthButtonClick() {
            if (isEditor()) {
                if (confirm('Logout dari mode editor? Anda akan kembali ke mode lihat.')) {
                    try {
                        await firebaseAuth.signOut();
                        showToast('Anda telah logout. Sekarang mode lihat saja.');
                    } catch (error) {
                        showToast('Logout gagal. Periksa koneksi internet lalu coba lagi.', true);
                    }
                }
            } else {
                openEditorLogin();
            }
        }
        function openEditorLogin() {
            document.getElementById('editorEmail').value = '';
            document.getElementById('editorPassword').value = '';
            document.getElementById('editorLoginError').classList.add('hidden');
            document.getElementById('editorLoginModal').classList.remove('hidden');
            setTimeout(() => document.getElementById('editorEmail').focus(), 50);
        }
        function closeEditorLogin() {
            document.getElementById('editorLoginModal').classList.add('hidden');
        }
        async function handleEditorLogin(e) {
            e.preventDefault();
            const email = document.getElementById('editorEmail').value.trim();
            const pass = document.getElementById('editorPassword').value;
            const errorEl = document.getElementById('editorLoginError');
            errorEl.classList.add('hidden');
            try {
                const credential = await firebaseAuth.signInWithEmailAndPassword(email, pass);
                if (!isAuthorizedEditor(credential.user)) {
                    await firebaseAuth.signOut();
                    errorEl.textContent = 'Akun ini belum diizinkan sebagai editor.';
                    errorEl.classList.remove('hidden');
                    return;
                }
                closeEditorLogin();
                showToast('Login Firebase berhasil. Mode Editor aktif.');
            } catch (error) {
                console.error('Firebase login failed:', error);
                errorEl.textContent = 'Email atau password salah.';
                errorEl.classList.remove('hidden');
            }
        }

        // ==========================================
        // STATE & KONFIGURASI
        // ==========================================
        const BULAN_LIST = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        let selectedBulan = "September";
        let selectedTahun = "2026";
        let activeTab = 'iwb'; 

        let appStore = { iwb: {}, ss: {}, itb: {}, kas: {}, pinjaman: {}, ceklis: {}, bendahara: {} };
        let deleteIndex = -1;
        let chartTren = null;
        let chartProporsi = null;
        
        const ANGGOTA_LIST = ["ABDUL ROJAK", "DAMAN SUTIAWAN", "DENDI NURJAMAN", "GUGUM GUMBIRA", "RISYAD NURDIANA SUMARLI"];

        const DEFAULT_2026_IWB = {
            "September": [
                { id: 1, nama: "ABDUL ROJAK", tot_iuran: 50000, ket: "Bayar 09 Sept 2026", tanggal: "" },
                { id: 2, nama: "DAMAN SUTIAWAN", tot_iuran: 130000, ket: "Bayar 02 Sept 2026", tanggal: "" },
                { id: 3, nama: "DENDI NURJAMAN", tot_iuran: 0, ket: "-", tanggal: "" },
                { id: 4, nama: "GUGUM GUMBIRA", tot_iuran: 50000, ket: "Bayar 27 Agu 2026", tanggal: "" },
                { id: 5, nama: "RISYAD NURDIANA SUMARLI", tot_iuran: 150000, ket: "-", tanggal: "" }
            ]
        };

        const DEFAULT_2026_SS = {
            "September": [
                { id: 1, nama: "ABDUL ROJAK", nominal: 0, setor: 0, ket: "", tanggal: "" },
                { id: 2, nama: "DAMAN SUTIAWAN", nominal: 70000, setor: 70000, ket: "Lunas", tanggal: "2026-09-02" },
                { id: 3, nama: "DENDI NURJAMAN", nominal: 0, setor: 0, ket: "", tanggal: "" },
                { id: 4, nama: "GUGUM GUMBIRA", nominal: 50000, setor: 50000, ket: "Lunas", tanggal: "2026-08-27" },
                { id: 5, nama: "RISYAD NURDIANA SUMARLI", nominal: 100000, setor: 50000, ket: "Lunas", tanggal: "2026-09-05" }
            ]
        };

        const DEFAULT_2026_ITB = {
            "September": [
                { id: 1, nama: "ABDUL ROJAK", nominal: 50000, setor: 50000, ket: "Tuntas", tanggal: "2026-09-09" },
                { id: 2, nama: "DAMAN SUTIAWAN", nominal: 50000, setor: 50000, ket: "Tuntas", tanggal: "2026-09-02" },
                { id: 3, nama: "DENDI NURJAMAN", nominal: 50000, setor: 50000, ket: "Tuntas", tanggal: "2026-09-05" },
                { id: 4, nama: "GUGUM GUMBIRA", nominal: 50000, setor: 50000, ket: "Tuntas", tanggal: "2026-08-27" },
                { id: 5, nama: "RISYAD NURDIANA SUMARLI", nominal: 50000, setor: 50000, ket: "Tuntas", tanggal: "2026-09-05" }
            ]
        };

        const DEFAULT_2026_KAS = {
            "September": [
                { id: 1, tanggal: "2026-08-01", ket: "Saldo Kas Agustus 2026", masuk: 1177500, keluar: 0 },
                { id: 2, tanggal: "2026-09-02", ket: "Akh daman bayar ITB", masuk: 50000, keluar: 0 },
                { id: 3, tanggal: "2026-09-05", ket: "Sisa TF IWB 25% bln Sept", masuk: 82500, keluar: 0 },
                { id: 4, tanggal: "2026-09-05", ket: "Ust Dendi bayar ITB", masuk: 50000, keluar: 0 },
                { id: 5, tanggal: "2026-09-05", ket: "Akh Risyad bayar ITB", masuk: 50000, keluar: 0 },
                { id: 6, tanggal: "2026-09-09", ket: "Akh Rojak bayar ITB", masuk: 50000, keluar: 0 },
                { id: 7, tanggal: "2026-09-09", ket: "Sisa TF IWB 25% bln Sept Susulan Akh Rojak", masuk: 12500, keluar: 0 },
                { id: 8, tanggal: "2026-09-09", ket: "Infaq Grup UPA", masuk: 30000, keluar: 0 },
                { id: 9, tanggal: "2026-09-10", ket: "TF ke Bendum DPD u/ Korban Bencana NTT", masuk: 0, keluar: 200000 }
            ]
        };

        const DEFAULT_2026_PINJAMAN = {
            "September": [
                { id: 1, nama: "ABDUL ROJAK", nominal: 250000, tgl_pinjam: "2026-09-10", tgl_bayar: "2026-10-10", status: "Lunas", ket: "Pinjaman Operasional Kebun" },
                { id: 2, nama: "DENDI NURJAMAN", nominal: 150000, tgl_pinjam: "2026-09-12", tgl_bayar: "", status: "Belum", ket: "Darurat" }
            ]
        };

        const DEFAULT_2026_BENDAHARA = {
            "September": [
                { id: 1, tanggal: "2026-09-01", ket: "Saldo Kas Agustus", masuk: 1417500, keluar: 0, catatan: "Otomatis" },
                { id: 2, tanggal: "2026-09-09", ket: "Setoran IWB Sept", masuk: 216000, keluar: 0, catatan: "Sudah Ditransfer" },
                { id: 3, tanggal: "2026-09-10", ket: "Bantuan Bencana NTT", masuk: 0, keluar: 200000, catatan: "Transfer DPD" }
            ]
        };

        // ==========================================
        // HELPER FUNCTIONS
        // ==========================================
        const fmt = (num) => {
            if (!num || isNaN(num)) return "0";
            return new Intl.NumberFormat("id-ID").format(num);
        };

        const rp = (num) => "Rp " + fmt(num);

        function splitIWB(tot) {
            const dpw = Math.round(tot * 0.15);
            const dpd = Math.round(tot * 0.30);
            const dpc = Math.round(tot * 0.30);
            const setor = dpw + dpd + dpc;
            const upa = tot - setor;
            return { dpw, dpd, dpc, setor, upa };
        }

        function formatMoneyInput(el) {
            let value = el.value.replace(/\D/g, '');
            if (value === '') { el.value = ''; return; }
            el.value = new Intl.NumberFormat('id-ID').format(parseInt(value, 10));
        }

        function cleanNumber(valStr) {
            if (!valStr) return 0;
            let digits = valStr.toString().replace(/\D/g, '');
            return parseFloat(digits) || 0;
        }

        function handleStatusPinjamanChange(status) {
            const tglBayar = document.getElementById('inputTglBayar');
            if (status === "Lunas") {
                tglBayar.disabled = false;
                tglBayar.classList.remove('bg-slate-100', 'cursor-not-allowed', 'opacity-60');
            } else {
                tglBayar.disabled = true;
                tglBayar.value = '';
                tglBayar.classList.add('bg-slate-100', 'cursor-not-allowed', 'opacity-60');
            }
        }

        // ==========================================
        // LOGIKA SWITCH TAB
        // ==========================================
        function switchTab(tab) {
            activeTab = tab;
            
            ['iwb', 'ss', 'itb', 'kas', 'pinjaman', 'ceklis', 'bendahara', 'rekap'].forEach(t => {
                document.getElementById(`nav-${t}`).className = "w-full py-3 px-3.5 rounded-lg transition flex items-center gap-3 text-emerald-100 hover:bg-emerald-700/50 font-bold";
            });
            
            document.getElementById(`nav-${tab}`).className = "w-full py-3 px-3.5 rounded-lg transition flex items-center gap-3 bg-white text-emerald-800 shadow-sm font-bold";
            
            const filterPeriode = document.getElementById('filter-periode');
            const dataTableArea = document.getElementById('data-table-area');
            const rekapArea = document.getElementById('rekap-area');

            if (tab === 'rekap') {
                filterPeriode.classList.add('hidden');
                dataTableArea.classList.add('hidden');
                rekapArea.classList.remove('hidden');
                document.getElementById('pageTitle').textContent = "8. Rekap & Chart Tahunan";
                document.getElementById('rekapTahun').value = selectedTahun;
                renderRekapTahunan();
            } else {
                filterPeriode.classList.remove('hidden');
                dataTableArea.classList.remove('hidden');
                rekapArea.classList.add('hidden');

                if (tab === 'iwb') {
                    document.getElementById('pageTitle').textContent = "1. Rekapan IWB";
                    document.getElementById('tableTitle').textContent = "REKAPAN IWB UPA 3216M010";
                } else if (tab === 'ss') {
                    document.getElementById('pageTitle').textContent = "2. Sumbangan Sukarela";
                    document.getElementById('tableTitle').textContent = "SUMBANGAN SUKARELA GRUP UPA";
                } else if (tab === 'itb') {
                    document.getElementById('pageTitle').textContent = "3. Rekapan ITB";
                    document.getElementById('tableTitle').textContent = "REKAPAN ITB GRUP UPA";
                } else if (tab === 'kas') {
                    document.getElementById('pageTitle').textContent = "4. Kas Grup UPA";
                    document.getElementById('tableTitle').textContent = "BUKU KAS GRUP UPA";
                } else if (tab === 'pinjaman') {
                    document.getElementById('pageTitle').textContent = "5. Pinjaman Anggota";
                    document.getElementById('tableTitle').textContent = "REKAPAN PINJAMAN ANGGOTA UPA";
                } else if (tab === 'ceklis') {
                    document.getElementById('pageTitle').textContent = "6. Ceklis Iuran UPA";
                    document.getElementById('tableTitle').textContent = "CEKLIS KELENGKAPAN IURAN UPA (OTOMATIS)";
                } else if (tab === 'bendahara') {
                    document.getElementById('pageTitle').textContent = "7. Catatan Bendahara";
                    document.getElementById('tableTitle').textContent = "CATATAN POSISI UANG DI BENDAHARA";
                }

                renderTable();
            }
        }

        // ==========================================
        // LOGIKA FILTER PERIODE
        // ==========================================
        function populateYearOptions() {
            const selectEl = document.getElementById('globalTahun');
            const selectRekap = document.getElementById('rekapTahun');
            selectEl.innerHTML = '';
            selectRekap.innerHTML = '';
            for (let y = 2025; y <= 2040; y++) {
                const opt = document.createElement('option');
                opt.value = y.toString();
                opt.textContent = y.toString();
                if (y.toString() === selectedTahun) opt.selected = true;
                selectEl.appendChild(opt);

                const optR = document.createElement('option');
                optR.value = y.toString();
                optR.textContent = y.toString();
                if (y.toString() === selectedTahun) optR.selected = true;
                selectRekap.appendChild(optR);
            }
        }

        function updatePeriodLabels() {
            const labelText = `${selectedBulan} ${selectedTahun}`;
            document.getElementById('period-display').textContent = labelText;
            document.getElementById('activeYearBadge').textContent = 'TH ' + selectedTahun;
        }

        function onPeriodChange() {
            selectedBulan = document.getElementById('globalBulan').value;
            selectedTahun = document.getElementById('globalTahun').value;
            updatePeriodLabels();
            renderTable();
        }

        function onRekapYearChange() {
            selectedTahun = document.getElementById('rekapTahun').value;
            document.getElementById('globalTahun').value = selectedTahun;
            document.getElementById('activeYearBadge').textContent = 'TH ' + selectedTahun;
            renderRekapTahunan();
        }

        function navigatePeriod(step) {
            let currentMonthIdx = BULAN_LIST.indexOf(selectedBulan);
            let newIdx = currentMonthIdx + step;
            let yearInt = parseInt(selectedTahun);

            if (newIdx < 0) { newIdx = 11; yearInt--; }
            else if (newIdx > 11) { newIdx = 0; yearInt++; }

            if (yearInt < 2025) yearInt = 2025;
            if (yearInt > 2040) yearInt = 2040;

            selectedBulan = BULAN_LIST[newIdx];
            selectedTahun = yearInt.toString();

            document.getElementById('globalBulan').value = selectedBulan;
            document.getElementById('globalTahun').value = selectedTahun;
            
            updatePeriodLabels();
            renderTable();
        }

        // ==========================================
        // LOGIKA DATABASE & FIREBASE
        // ==========================================
        function loadData() {
            const saved = localStorage.getItem(LOCAL_STORE_KEY);
            if (saved) {
                try { appStore = normalizeStore(JSON.parse(saved)); } 
                catch (e) { initDefaultStore(); }
            } else {
                initDefaultStore();
            }
        }

        function initDefaultStore() {
            appStore = { 
                iwb: { "2026": DEFAULT_2026_IWB },
                ss: { "2026": DEFAULT_2026_SS },
                itb: { "2026": DEFAULT_2026_ITB },
                kas: { "2026": DEFAULT_2026_KAS },
                pinjaman: { "2026": DEFAULT_2026_PINJAMAN },
                ceklis: {},
                bendahara: { "2026": DEFAULT_2026_BENDAHARA }
            };
            saveToLocal();
        }

        function saveToLocal() {
            try { localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(appStore)); } catch(e) {}
            scheduleCloudSave();
        }

        function normalizeStore(s) {
            const out = {};
            s = (s && typeof s === 'object') ? s : {};
            ['iwb', 'ss', 'itb', 'ceklis', 'kas', 'pinjaman'].forEach(k => {
                out[k] = {};
                const src = (s[k] && typeof s[k] === 'object') ? s[k] : {};
                Object.keys(src).forEach(y => {
                    out[k][y] = {};
                    const months = src[y] || {};
                    Object.keys(months).forEach(m => {
                        (Array.isArray(months[m]) ? months[m] : []).forEach(it => {
                            if (!it || typeof it !== 'object') return;
                            (out[k][y][m] = out[k][y][m] || []).push(it);
                        });
                    });
                });
            });
            ['bendahara'].forEach(k => {
                out[k] = {};
                const b = (s[k] && typeof s[k] === 'object') ? s[k] : {};
                Object.keys(b).forEach(y => { out[k][y] = Array.isArray(b[y]) ? b[y].filter(x => x && typeof x === 'object') : []; });
            });
            if (!s.pinjaman) out.pinjaman = { "2026": DEFAULT_2026_PINJAMAN };
            return out;
        }

        function scheduleCloudSave(force = false) {
            if (!cloudSyncReady || !isEditor()) return;
            const serialized = JSON.stringify(appStore);
            if (!force && serialized === lastCloudSerialized) return;
            if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
            cloudSaveTimer = setTimeout(async () => {
                cloudSaveTimer = null;
                if (!cloudSyncReady || !isEditor()) return;
                const latestSerialized = JSON.stringify(appStore);
                if (!force && latestSerialized === lastCloudSerialized) return;
                try {
                    await cloudDocRef.set({
                        appStore: JSON.parse(latestSerialized),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedBy: firebaseAuth.currentUser.uid
                    }, { merge: true });
                    lastCloudSerialized = latestSerialized;
                } catch (error) {
                    console.error('Firestore write failed:', error);
                }
            }, CLOUD_SAVE_DELAY_MS);
        }

        function startCloudSync() {
            if (!appInitialized) return;
            if (cloudUnsubscribe) { cloudUnsubscribe(); cloudUnsubscribe = null; }
            cloudSyncReady = false;
            let initialSnapshotHandled = false;
            cloudUnsubscribe = cloudDocRef.onSnapshot((snapshot) => {
                try {
                    const docData = snapshot.exists ? snapshot.data() : null;
                    const cloudStore = docData && docData.appStore;
                    if (cloudStore && typeof cloudStore === 'object' && !Array.isArray(cloudStore)) {
                        const normalized = normalizeStore(cloudStore);
                        const cloudSerialized = JSON.stringify(normalized);
                        const localSerialized = JSON.stringify(appStore);
                        lastCloudSerialized = cloudSerialized;
                        cloudSyncReady = true;
                        if (cloudSerialized !== localSerialized) {
                            appStore = normalized;
                            try { localStorage.setItem(LOCAL_STORE_KEY, cloudSerialized); } catch (storageError) {}
                            if (activeTab === 'rekap') renderRekapTahunan();
                            else renderTable();
                        }
                    } else {
                        cloudSyncReady = true;
                        lastCloudSerialized = '';
                        if (isEditor()) scheduleCloudSave(true);
                    }
                    initialSnapshotHandled = true;
                } catch (error) {
                    console.error('Firestore snapshot processing failed:', error);
                }
            }, (error) => {
                cloudSyncReady = false;
                console.error('Firestore listener failed:', error);
            });
        }

        // ==========================================
        // LOGIKA OTOMATISASI (CEKLIS & BENDAHARA)
        // ==========================================
        function generateAutoCeklis() {
            const iwbData = appStore.iwb[selectedTahun]?.[selectedBulan] || [];
            const ssData = appStore.ss[selectedTahun]?.[selectedBulan] || [];
            const itbData = appStore.itb[selectedTahun]?.[selectedBulan] || [];

            return ANGGOTA_LIST.map(nama => {
                const iwbItem = iwbData.find(d => d.nama === nama);
                const iwbStatus = (iwbItem && Number(iwbItem.tot_iuran) > 0) ? '✓' : '✗';

                const itbItem = itbData.find(d => d.nama === nama);
                const itbStatus = (itbItem && Number(itbItem.nominal) > 0) ? '✓' : '✗';

                const ssItem = ssData.find(d => d.nama === nama);
                const ssStatus = (ssItem && Number(ssItem.nominal) > 0) ? '✓' : '✗';

                let ket = "Belum lengkap";
                if (iwbStatus === '✓' && itbStatus === '✓' && ssStatus === '✓') ket = "Lunas Semua";
                else if (iwbStatus === '✓' && itbStatus === '✓') ket = "IWB & ITB Lunas";
                else if (iwbStatus === '✓') ket = "Hanya IWB";
                else if (itbStatus === '✓') ket = "Hanya ITB";
                else if (ssStatus === '✓') ket = "Hanya SS";

                return { nama: nama, iwb: iwbStatus, itb: itbStatus, ss: ssStatus, ket: ket };
            });
        }

        // ==========================================
        // RENDER TABEL DATA
        // ==========================================
        function renderTable() {
            const thead = document.getElementById('tableHead');
            const tbody = document.getElementById('tableBody');
            const tfoot = document.getElementById('tableFoot');
            
            let dataBulanIni = [];
            if (activeTab === 'ceklis') {
                dataBulanIni = generateAutoCeklis();
            } else {
                const yearData = appStore[activeTab][selectedTahun] || {};
                dataBulanIni = yearData[selectedBulan] || [];
            }

            if (dataBulanIni.length === 0 && activeTab !== 'ceklis' && activeTab !== 'bendahara' && activeTab !== 'kas') {
                tbody.innerHTML = `<tr><td colspan="10" class="px-4 py-8 text-center text-slate-400 italic">Data Kosong pada Periode ${selectedBulan} ${selectedTahun}.</td></tr>`;
                tfoot.innerHTML = '';
                return;
            }

            const editorMode = isEditor();
            const colAksi = editorMode ? `<th class="px-2 py-3 text-center no-print editor-only w-[10%]">Aksi</th>` : '';

            if (activeTab === 'iwb') {
                thead.innerHTML = `
                    <tr>
                        <th class="px-1 py-3 border-r border-emerald-500/50 w-[5%]">No</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[20%]">Nama Anggota</th>
                        <th class="px-2 py-3 border-r border-emerald-500/50 w-[10%]">Total Iuran</th>
                        <th class="px-2 py-3 border-r border-emerald-500/50 bg-emerald-700 w-[9%]">DPW (15%)</th>
                        <th class="px-2 py-3 border-r border-emerald-500/50 bg-emerald-700 w-[9%]">DPD (30%)</th>
                        <th class="px-2 py-3 border-r border-emerald-500/50 bg-emerald-700 w-[9%]">DPC (30%)</th>
                        <th class="px-2 py-3 border-r border-emerald-500/50 bg-teal-600 w-[9%]">UPA (25%)</th>
                        <th class="px-2 py-3 border-r border-emerald-500/50 bg-emerald-500 w-[10%]">Setor 75%</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 ${!editorMode ? 'w-[18%]' : 'w-[15%]'}">KET</th>
                        ${colAksi}
                    </tr>
                `;

                let sumTot = 0, sumDpw = 0, sumDpd = 0, sumDpc = 0, sumUpa = 0, sumSetor = 0;
                tbody.innerHTML = dataBulanIni.map((item, idx) => {
                    const tot = item.tot_iuran || 0;
                    const { dpw, dpd, dpc, upa, setor } = splitIWB(tot);
                    sumTot += tot; sumDpw += dpw; sumDpd += dpd; sumDpc += dpc; sumUpa += upa; sumSetor += setor;

                    const actionTd = editorMode ? `
                        <td class="px-2 py-2.5 text-center space-x-1 no-print editor-only">
                            <button onclick="openEditModal(${idx})" class="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded transition" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="openDeleteModal(${idx})" class="p-1.5 text-rose-600 hover:bg-rose-100 rounded transition" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                        </td>` : '';

                    return `
                    <tr class="hover:bg-emerald-50/50 transition">
                        <td class="px-1 py-2.5 text-center font-bold border-r border-slate-200">${idx + 1}</td>
                        <td class="px-3 py-2.5 font-bold text-slate-900 border-r border-slate-200">${item.nama}</td>
                        <td class="px-2 py-2.5 text-right font-bold text-slate-900 border-r border-slate-200">${fmt(tot)}</td>
                        <td class="px-2 py-2.5 text-right border-r border-slate-200 bg-emerald-50/30">${fmt(dpw)}</td>
                        <td class="px-2 py-2.5 text-right border-r border-slate-200 bg-emerald-50/30">${fmt(dpd)}</td>
                        <td class="px-2 py-2.5 text-right border-r border-slate-200 bg-emerald-50/30">${fmt(dpc)}</td>
                        <td class="px-2 py-2.5 text-right font-extrabold border-r border-slate-200 bg-teal-50 text-teal-800">${fmt(upa)}</td>
                        <td class="px-2 py-2.5 text-right font-bold border-r border-slate-200 bg-emerald-100 text-emerald-800">${fmt(setor)}</td>
                        <td class="px-3 py-2.5 text-center text-slate-500 border-r border-slate-200">${item.ket || '-'}</td>
                        ${actionTd}
                    </tr>`;
                }).join('');

                tfoot.innerHTML = `
                <tr>
                    <td colspan="2" class="px-3 py-3 border-r border-emerald-200 text-center">JUMLAH TOTAL</td>
                    <td class="px-2 py-3 text-right border-r border-emerald-200">${fmt(sumTot)}</td>
                    <td class="px-2 py-3 text-right border-r border-emerald-200">${fmt(sumDpw)}</td>
                    <td class="px-2 py-3 text-right border-r border-emerald-200">${fmt(sumDpd)}</td>
                    <td class="px-2 py-3 text-right border-r border-emerald-200">${fmt(sumDpc)}</td>
                    <td class="px-2 py-3 text-right border-r border-emerald-200 text-teal-800">${fmt(sumUpa)}</td>
                    <td class="px-2 py-3 text-right border-r border-emerald-200 text-emerald-800">${fmt(sumSetor)}</td>
                    <td colspan="${editorMode ? 2 : 1}" class="px-3 py-3 no-print"></td>
                </tr>`;

            } else if (activeTab === 'ss' || activeTab === 'itb') {
                thead.innerHTML = `
                    <tr>
                        <th class="px-1 py-3 border-r border-emerald-500/50 w-[5%]">No</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[20%]">Nama Anggota</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[15%]">Nominal (Rp)</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[15%]">Tanggal Bayar</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[15%]">SDH DISETORKAN</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 ${!editorMode ? 'w-[30%]' : 'w-[20%]'}">KET</th>
                        ${colAksi}
                    </tr>
                `;

                let sumNom = 0, sumSetor = 0;
                tbody.innerHTML = dataBulanIni.map((item, idx) => {
                    sumNom += (item.nominal || 0);
                    sumSetor += (item.setor || 0);
                    
                    const actionTd = editorMode ? `
                        <td class="px-2 py-2.5 text-center space-x-1 no-print editor-only">
                            <button onclick="openEditModal(${idx})" class="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded transition" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="openDeleteModal(${idx})" class="p-1.5 text-rose-600 hover:bg-rose-100 rounded transition" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                        </td>` : '';

                    return `
                    <tr class="hover:bg-emerald-50/50 transition">
                        <td class="px-1 py-2.5 text-center font-bold border-r border-slate-200">${idx + 1}</td>
                        <td class="px-3 py-2.5 font-bold text-slate-900 border-r border-slate-200">${item.nama}</td>
                        <td class="px-3 py-2.5 text-right font-extrabold text-emerald-700 border-r border-slate-200">${fmt(item.nominal)}</td>
                        <td class="px-3 py-2.5 text-center border-r border-slate-200">${item.tanggal || '-'}</td>
                        <td class="px-3 py-2.5 text-right font-bold text-emerald-800 border-r border-slate-200">${item.setor ? fmt(item.setor) : '-'}</td>
                        <td class="px-3 py-2.5 text-center text-slate-500 border-r border-slate-200">${item.ket || '-'}</td>
                        ${actionTd}
                    </tr>`;
                }).join('');

                const labelTotal = activeTab === 'ss' ? 'TOTAL SUMBANGAN SUKARELA' : 'TOTAL ITB GRUP';
                tfoot.innerHTML = `
                <tr>
                    <td colspan="2" class="px-3 py-3 border-r border-emerald-200 text-center">${labelTotal}</td>
                    <td class="px-3 py-3 text-right border-r border-emerald-200 text-emerald-700">${fmt(sumNom)}</td>
                    <td class="px-3 py-3 no-print"></td>
                    <td class="px-3 py-3 text-right border-r border-emerald-200 text-emerald-700">${fmt(sumSetor)}</td>
                    <td colspan="${editorMode ? 2 : 1}" class="px-3 py-3 no-print"></td>
                </tr>`;

            } else if (activeTab === 'kas') {
                thead.innerHTML = `
                    <tr>
                        <th class="px-1 py-3 border-r border-emerald-500/50 w-[5%]">No</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[15%]">Tanggal</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 ${!editorMode ? 'w-[40%]' : 'w-[30%]'}">Keterangan Transaksi</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 text-emerald-200 w-[12%]">Pemasukan (Rp)</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 text-rose-200 w-[12%]">Pengeluaran (Rp)</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 text-amber-200 w-[16%]">Saldo (Rp)</th>
                        ${colAksi}
                    </tr>
                `;

                const currentMonthIdx = BULAN_LIST.indexOf(selectedBulan);
                const yearInt = parseInt(selectedTahun);
                
                let saldoAwalBulanIni = 0;
                let prevBulanName = "";

                // MENCARI DATA PALING AWAL (JANUARI) UNTUK MULAI HITUNG
                let firstMonthWithDataIdx = -1;
                for (let i = 0; i < 12; i++) {
                    const kasData = appStore.kas[yearInt.toString()]?.[BULAN_LIST[i]] || [];
                    const validData = kasData.filter(x => x.id !== 'auto-kas');
                    if (validData.length > 0) {
                        firstMonthWithDataIdx = i;
                        break;
                    }
                }

                if (firstMonthWithDataIdx !== -1 && firstMonthWithDataIdx < currentMonthIdx) {
                    // Hitung saldo kumulatif dari bulan pertama ada data, sampai bulan SEBELUM bulan aktif
                    for (let i = firstMonthWithDataIdx; i < currentMonthIdx; i++) {
                        const kasData = appStore.kas[yearInt.toString()]?.[BULAN_LIST[i]] || [];
                        const validData = kasData.filter(x => x.id !== 'auto-kas');
                        
                        validData.forEach(item => {
                            saldoAwalBulanIni += (item.masuk || 0) - (item.keluar || 0);
                        });
                        prevBulanName = BULAN_LIST[i];
                    }
                } else {
                    // Jika bulan ini adalah bulan pertama ada data, atau belum ada data sama sekali
                    prevBulanName = BULAN_LIST[currentMonthIdx === 0 ? 11 : currentMonthIdx - 1];
                    saldoAwalBulanIni = 0; 
                }

                const autoRow = {
                    id: 'auto-kas',
                    tanggal: `${selectedTahun}-${String(currentMonthIdx + 1).padStart(2, '0')}-01`,
                    ket: `Saldo Kas Bulan ${prevBulanName}`,
                    masuk: saldoAwalBulanIni,
                    keluar: 0,
                    catatan: 'Otomatis'
                };

                const finalList = [autoRow, ...dataBulanIni];

                let runningSaldo = 0, totalMasuk = 0, totalKeluar = 0;
                tbody.innerHTML = finalList.map((item, idx) => {
                    const m = item.masuk || 0;
                    const k = item.keluar || 0;
                    totalMasuk += m; totalKeluar += k; runningSaldo += (m - k);
                    
                    const isAuto = item.id === 'auto-kas';
                    const actionButtons = isAuto 
                        ? `<span class="text-[10px] text-slate-400 italic">Otomatis</span>`
                        : `<button onclick="openEditModal(${idx - 1})" class="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded transition" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                           <button onclick="openDeleteModal(${idx - 1})" class="p-1.5 text-rose-600 hover:bg-rose-100 rounded transition" title="Hapus"><i class="fa-solid fa-trash"></i></button>`;

                    const actionTd = editorMode ? `
                        <td class="px-2 py-2.5 text-center space-x-1 no-print editor-only">
                            ${actionButtons}
                        </td>` : '';

                    return `
                    <tr class="hover:bg-emerald-50/50 transition ${isAuto ? 'bg-emerald-50/30' : ''}">
                        <td class="px-1 py-2.5 text-center font-bold border-r border-slate-200">${idx + 1}</td>
                        <td class="px-3 py-2.5 text-center border-r border-slate-200">${item.tanggal || '-'}</td>
                        <td class="px-3 py-2.5 font-bold ${isAuto ? 'text-emerald-800' : 'text-slate-900'} border-r border-slate-200">${item.ket || '-'}</td>
                        <td class="px-3 py-2.5 text-right text-emerald-700 font-extrabold border-r border-slate-200">${m > 0 ? fmt(m) : '-'}</td>
                        <td class="px-3 py-2.5 text-right text-rose-600 font-extrabold border-r border-slate-200">${k > 0 ? fmt(k) : '-'}</td>
                        <td class="px-3 py-2.5 text-right text-slate-950 font-black border-r border-slate-200 bg-orange-50/30">${fmt(runningSaldo)}</td>
                        ${actionTd}
                    </tr>`;
                }).join('');

                tfoot.innerHTML = `
                <tr>
                    <td colspan="3" class="px-3 py-3 border-r border-emerald-200 text-center">JUMLAH MUTASI & SALDO AKHIR KAS</td>
                    <td class="px-3 py-3 text-right border-r border-emerald-200 text-emerald-700">${fmt(totalMasuk)}</td>
                    <td class="px-3 py-3 text-right border-r border-emerald-200 text-rose-600">${fmt(totalKeluar)}</td>
                    <td class="px-3 py-3 text-right border-r border-emerald-200 text-emerald-900 text-sm">${fmt(runningSaldo)}</td>
                    <td colspan="${editorMode ? 1 : 0}" class="px-2 py-3 no-print"></td>
                </tr>`;

            } else if (activeTab === 'pinjaman') {
                thead.innerHTML = `
                    <tr>
                        <th class="px-1 py-3 border-r border-emerald-500/50 w-[5%]">No</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[20%]">Nama Anggota</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[15%]">Nominal (Rp)</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[12%]">Tgl Pinjam</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[12%]">Tgl Bayar</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[15%]">Status</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 ${!editorMode ? 'w-[21%]' : 'w-[16%]'}">KET</th>
                        ${colAksi}
                    </tr>
                `;

                                let sumNom = 0;
                tbody.innerHTML = dataBulanIni.map((item, idx) => {
                    const nom = item.nominal || 0;
                    const isLunas = item.status === "Lunas";
                    
                    // Hanya tambahkan ke total jika statusnya BUKAN "Lunas"
                    if (!isLunas) {
                        sumNom += nom; 
                    }
                    
                    const colorNominal = isLunas ? 'text-slate-400' : 'text-emerald-700';
                    const badgeStatus = isLunas 
                        ? `<span class="inline-block whitespace-nowrap bg-slate-100 text-slate-500 border border-slate-300 text-[10px] px-2.5 py-1 rounded-full font-bold">✓ Lunas</span>`
                        : `<span class="inline-block whitespace-nowrap bg-rose-100 text-rose-700 border border-rose-200 text-[10px] px-2.5 py-1 rounded-full font-bold">✗ Belum Lunas</span>`;

                    const actionTd = editorMode ? `
                        <td class="px-2 py-2.5 text-center space-x-1 no-print editor-only">
                            <button onclick="openEditModal(${idx})" class="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded transition" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="openDeleteModal(${idx})" class="p-1.5 text-rose-600 hover:bg-rose-100 rounded transition" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                        </td>` : '';

                    return `
                    <tr class="hover:bg-emerald-50/50 transition">
                        <td class="px-1 py-2.5 text-center font-bold border-r border-slate-200">${idx + 1}</td>
                        <td class="px-3 py-2.5 font-bold ${isLunas ? 'text-slate-500' : 'text-slate-900'} border-r border-slate-200">${item.nama}</td>
                        <td class="px-3 py-2.5 text-right font-extrabold ${colorNominal} border-r border-slate-200">${fmt(nom)}</td>
                        <td class="px-3 py-2.5 text-center border-r border-slate-200">${item.tgl_pinjam || '-'}</td>
                        <td class="px-3 py-2.5 text-center border-r border-slate-200 ${isLunas ? 'text-slate-600' : 'text-slate-400'}">${item.tgl_bayar || '-'}</td>
                        <td class="px-3 py-2.5 text-center border-r border-slate-200">${badgeStatus}</td>
                        <td class="px-3 py-2.5 text-center text-slate-500 border-r border-slate-200">${item.ket || '-'}</td>
                        ${actionTd}
                    </tr>`;
                }).join('');

                tfoot.innerHTML = `
                <tr>
                    <td colspan="2" class="px-3 py-3 border-r border-emerald-200 text-center">TOTAL PINJAMAN</td>
                    <td class="px-3 py-3 text-right border-r border-emerald-200 text-emerald-700">${fmt(sumNom)}</td>
                    <td colspan="${editorMode ? 5 : 4}" class="px-3 py-3 no-print"></td>
                </tr>`;

            } else if (activeTab === 'ceklis') {
                thead.innerHTML = `
                    <tr>
                        <th class="px-1 py-3 border-r border-emerald-500/50 w-[5%]">No</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[25%]">Nama Anggota</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[10%] text-center">ITB</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[10%] text-center">IWB</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[10%] text-center">SS</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 ${!editorMode ? 'w-[40%]' : 'w-[30%]'}">KET</th>
                        ${colAksi}
                    </tr>
                `;

                tbody.innerHTML = dataBulanIni.map((item, idx) => {
                    const renderSymbol = (val) => {
                        if (val === '✓') return `<span class="inline-block bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs px-3 py-1 rounded-full font-black">✓</span>`;
                        if (val === '✗') return `<span class="inline-block bg-rose-100 text-rose-700 border border-rose-300 text-xs px-3 py-1 rounded-full font-black">✗</span>`;
                        return `<span class="inline-block bg-slate-100 text-slate-500 text-xs px-3 py-1 rounded-full font-bold">-</span>`;
                    };

                    const actionTd = editorMode ? `
                        <td class="px-2 py-2.5 text-center space-x-1 no-print editor-only">
                            <button onclick="openEditCeklisModal(${idx})" class="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded transition" title="Edit Keterangan"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="deleteCeklisKeterangan(${idx})" class="p-1.5 text-rose-600 hover:bg-rose-100 rounded transition" title="Hapus Keterangan"><i class="fa-solid fa-trash"></i></button>
                        </td>` : '';

                    return `
                    <tr class="hover:bg-emerald-50/50 transition">
                        <td class="px-1 py-2.5 text-center font-bold border-r border-slate-200">${idx + 1}</td>
                        <td class="px-3 py-2.5 font-bold text-slate-900 border-r border-slate-200">${item.nama}</td>
                        <td class="px-3 py-2.5 text-center border-r border-slate-200">${renderSymbol(item.itb)}</td>
                        <td class="px-3 py-2.5 text-center border-r border-slate-200">${renderSymbol(item.iwb)}</td>
                        <td class="px-3 py-2.5 text-center border-r border-slate-200">${renderSymbol(item.ss)}</td>
                        <td class="px-3 py-2.5 text-center text-slate-600 border-r border-slate-200">${item.ket || '-'}</td>
                        ${actionTd}
                    </tr>`;
                }).join('');

                tfoot.innerHTML = ''; 

            } else if (activeTab === 'bendahara') {
                thead.innerHTML = `
                    <tr>
                        <th class="px-1 py-3 border-r border-emerald-500/50 w-[5%]">No</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 w-[15%]">Tanggal</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 ${!editorMode ? 'w-[35%]' : 'w-[25%]'}">Keterangan Transaksi</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 text-emerald-200 w-[12%]">Pemasukan (Rp)</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 text-rose-200 w-[12%]">Pengeluaran (Rp)</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 text-amber-200 w-[11%]">Saldo (Rp)</th>
                        <th class="px-3 py-3 border-r border-emerald-500/50 ${!editorMode ? 'w-[15%]' : 'w-[10%]'}">Catatan</th>
                        ${colAksi}
                    </tr>
                `;

                const currentMonthIdx = BULAN_LIST.indexOf(selectedBulan);
                const yearInt = parseInt(selectedTahun);
                
                let saldoAwalBulanIni = 0;
                let prevBulanName = "";

                // MENCARI DATA PALING AWAL (JANUARI) UNTUK MULAI HITUNG
                let firstMonthWithDataIdx = -1;
                for (let i = 0; i < 12; i++) {
                    const bendaharaData = appStore.bendahara[yearInt.toString()]?.[BULAN_LIST[i]] || [];
                    const validData = bendaharaData.filter(x => x.id !== 'auto-bendahara');
                    if (validData.length > 0) {
                        firstMonthWithDataIdx = i;
                        break;
                    }
                }

                if (firstMonthWithDataIdx !== -1 && firstMonthWithDataIdx < currentMonthIdx) {
                    // Hitung saldo kumulatif dari bulan pertama ada data, sampai bulan SEBELUM bulan aktif
                    for (let i = firstMonthWithDataIdx; i < currentMonthIdx; i++) {
                        const bendaharaData = appStore.bendahara[yearInt.toString()]?.[BULAN_LIST[i]] || [];
                        const validData = bendaharaData.filter(x => x.id !== 'auto-bendahara');
                        
                        validData.forEach(item => {
                            saldoAwalBulanIni += (item.masuk || 0) - (item.keluar || 0);
                        });
                        prevBulanName = BULAN_LIST[i];
                    }
                } else {
                    prevBulanName = BULAN_LIST[currentMonthIdx === 0 ? 11 : currentMonthIdx - 1];
                    saldoAwalBulanIni = 0; 
                }

                const autoRow = {
                    id: 'auto-bendahara',
                    tanggal: `${selectedTahun}-${String(currentMonthIdx + 1).padStart(2, '0')}-01`,
                    ket: `Saldo Kas Bulan ${prevBulanName}`,
                    masuk: saldoAwalBulanIni,
                    keluar: 0,
                    catatan: 'Otomatis'
                };

                const manualData = appStore.bendahara[selectedTahun]?.[selectedBulan] || [];
                const finalList = [autoRow, ...manualData];

                let runningSaldo = 0, totalMasuk = 0, totalKeluar = 0;
                tbody.innerHTML = finalList.map((item, idx) => {
                    const m = item.masuk || 0;
                    const k = item.keluar || 0;
                    totalMasuk += m; totalKeluar += k; runningSaldo += (m - k);
                    
                    const isAuto = item.id === 'auto-bendahara';
                    const actionButtons = isAuto 
                        ? `<span class="text-[10px] text-slate-400 italic">Otomatis</span>`
                        : `<button onclick="openEditModal(${idx - 1})" class="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded transition" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                           <button onclick="openDeleteModal(${idx - 1})" class="p-1.5 text-rose-600 hover:bg-rose-100 rounded transition" title="Hapus"><i class="fa-solid fa-trash"></i></button>`;

                    const actionTd = editorMode ? `
                        <td class="px-2 py-2.5 text-center space-x-1 no-print editor-only">
                            ${actionButtons}
                        </td>` : '';

                    return `
                    <tr class="hover:bg-emerald-50/50 transition ${isAuto ? 'bg-emerald-50/30' : ''}">
                        <td class="px-1 py-2.5 text-center font-bold border-r border-slate-200">${idx + 1}</td>
                        <td class="px-3 py-2.5 text-center border-r border-slate-200">${item.tanggal || '-'}</td>
                        <td class="px-3 py-2.5 font-bold ${isAuto ? 'text-emerald-800' : 'text-slate-900'} border-r border-slate-200">${item.ket || '-'}</td>
                        <td class="px-3 py-2.5 text-right text-emerald-700 font-extrabold border-r border-slate-200">${m > 0 ? fmt(m) : '-'}</td>
                        <td class="px-3 py-2.5 text-right text-rose-600 font-extrabold border-r border-slate-200">${k > 0 ? fmt(k) : '-'}</td>
                        <td class="px-3 py-2.5 text-right text-slate-950 font-black border-r border-slate-200 bg-orange-50/30">${fmt(runningSaldo)}</td>
                        <td class="px-3 py-2.5 text-center text-slate-500 border-r border-slate-200">${item.catatan || '-'}</td>
                        ${actionTd}
                    </tr>`;
                }).join('');

                tfoot.innerHTML = `
                <tr>
                    <td colspan="3" class="px-3 py-3 border-r border-emerald-200 text-center">TOTAL SALDO BENDAHARA</td>
                    <td class="px-3 py-3 text-right border-r border-emerald-200 text-emerald-700">${fmt(totalMasuk)}</td>
                    <td class="px-3 py-3 text-right border-r border-emerald-200 text-rose-600">${fmt(totalKeluar)}</td>
                    <td class="px-3 py-3 text-right border-r border-emerald-200 text-emerald-900 text-sm">${fmt(runningSaldo)}</td>
                    <td colspan="${editorMode ? 2 : 1}" class="px-3 py-3 no-print"></td>
                </tr>`;
            }
        }

        // ==========================================
        // RENDER REKAP TAHUNAN & CHART (BAWAH)
        // ==========================================
        function renderRekapTahunan() {
            const y = selectedTahun;
            const iwbData = appStore.iwb[y] || {};
            const itbData = appStore.itb[y] || {};
            const ssData = appStore.ss[y] || {};
            const pinjamanData = appStore.pinjaman[y] || {};

            let totalIWB = 0, totalITB = 0, totalSS = 0;
            let totalPiutang = 0;

            Object.values(iwbData).forEach(bulan => bulan.forEach(item => totalIWB += (item.tot_iuran || 0)));
            Object.values(itbData).forEach(bulan => bulan.forEach(item => totalITB += (item.nominal || 0)));
            Object.values(ssData).forEach(bulan => bulan.forEach(item => totalSS += (item.nominal || 0)));

            Object.keys(pinjamanData).forEach(bulan => {
                pinjamanData[bulan].forEach(item => {
                    if (item.status === 'Belum') {
                        totalPiutang += (item.nominal || 0);
                    }
                });
            });

            document.getElementById('kpi-container').innerHTML = `
                <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <div class="w-12 h-12 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl"><i class="fa-solid fa-table-cells"></i></div>
                    <div><p class="text-[10px] font-bold uppercase text-slate-500">Total IWB</p><p class="text-lg font-black text-slate-900">${rp(totalIWB)}</p></div>
                </div>
                <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <div class="w-12 h-12 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center text-xl"><i class="fa-solid fa-gem"></i></div>
                    <div><p class="text-[10px] font-bold uppercase text-slate-500">Total ITB</p><p class="text-lg font-black text-slate-900">${rp(totalITB)}</p></div>
                </div>
                <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <div class="w-12 h-12 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center text-xl"><i class="fa-solid fa-hand-holding-heart"></i></div>
                    <div><p class="text-[10px] font-bold uppercase text-slate-500">Total SS</p><p class="text-lg font-black text-slate-900">${rp(totalSS)}</p></div>
                </div>
                <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                    <div class="w-12 h-12 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xl"><i class="fa-solid fa-hand-holding-dollar"></i></div>
                    <div><p class="text-[10px] font-bold uppercase text-slate-500">Piutang</p><p class="text-lg font-black text-slate-900">${rp(totalPiutang)}</p><p class="text-[9px] text-slate-400">Pinjaman Belum Lunas</p></div>
                </div>
            `;

            document.querySelectorAll('.rekap-year-label').forEach(el => el.textContent = selectedTahun);

            const tbodyBottom = document.getElementById('tbody-rekap-bottom');
            const tfootBottom = document.getElementById('tfoot-rekap-bottom');

            let sumIWB = 0, sumITB = 0, sumSS = 0, sumTotal = 0;
            tbodyBottom.innerHTML = BULAN_LIST.map(m => {
                const iwb = (iwbData[m] || []).reduce((sum, item) => sum + (item.tot_iuran || 0), 0);
                const itb = (itbData[m] || []).reduce((sum, item) => sum + (item.nominal || 0), 0);
                const ss = (ssData[m] || []).reduce((sum, item) => sum + (item.nominal || 0), 0);
                const total = iwb + itb + ss;
                sumIWB += iwb; sumITB += itb; sumSS += ss; sumTotal += total;

                return `
                <tr class="hover:bg-emerald-50/50 transition">
                    <td class="px-4 py-2.5 font-bold text-slate-900 border-r border-slate-200">${m}</td>
                    <td class="px-4 py-2.5 text-right border-r border-slate-200">${fmt(iwb)}</td>
                    <td class="px-4 py-2.5 text-right border-r border-slate-200">${fmt(itb)}</td>
                    <td class="px-4 py-2.5 text-right border-r border-slate-200">${fmt(ss)}</td>
                    <td class="px-4 py-2.5 text-right font-black text-emerald-800 border-r border-slate-200 bg-emerald-50">${fmt(total)}</td>
                </tr>`;
            }).join('');

            tfootBottom.innerHTML = `
            <tr>
                <td class="px-4 py-3 text-center border-r border-emerald-200">JUMLAH TOTAL</td>
                <td class="px-4 py-3 text-right border-r border-emerald-200">${fmt(sumIWB)}</td>
                <td class="px-4 py-3 text-right border-r border-emerald-200">${fmt(sumITB)}</td>
                <td class="px-4 py-3 text-right border-r border-emerald-200">${fmt(sumSS)}</td>
                <td class="px-4 py-3 text-right text-emerald-900 border-r border-emerald-200">${fmt(sumTotal)}</td>
            </tr>`;

            if (typeof Chart === 'undefined') return;
            
            if (chartTren) chartTren.destroy();
            if (chartProporsi) chartProporsi.destroy();

                        // ==========================================
            // RENDER DAFTAR PIUTANG (BELUM LUNAS)
            // ==========================================
            const tbodyPiutang = document.getElementById('tbody-piutang-rekap');
            const tfootPiutang = document.getElementById('tfoot-piutang-rekap');
            
            let listPiutang = [];
            
            // Looping semua bulan di tahun yang dipilih, ambil yang statusnya "Belum"
            Object.keys(pinjamanData).forEach(bulan => {
                pinjamanData[bulan].forEach(item => {
                    if (item.status === 'Belum') {
                        listPiutang.push(item);
                    }
                });
            });

            if (listPiutang.length === 0) {
                tbodyPiutang.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400 italic">Tidak ada piutang aktif (semua pinjaman sudah lunas) pada tahun ${selectedTahun}.</td></tr>`;
                tfootPiutang.innerHTML = '';
            } else {
                let totalPiutangAktif = 0;
                tbodyPiutang.innerHTML = listPiutang.map((item, idx) => {
                    const nom = item.nominal || 0;
                    totalPiutangAktif += nom;
                    
                    return `
                    <tr class="hover:bg-rose-50/50 transition">
                        <td class="px-4 py-2.5 text-center font-bold border-r border-slate-200">${idx + 1}</td>
                        <td class="px-4 py-2.5 font-bold text-slate-900 border-r border-slate-200">${item.nama}</td>
                        <td class="px-4 py-2.5 text-right font-extrabold text-rose-700 border-r border-slate-200">${fmt(nom)}</td>
                        <td class="px-4 py-2.5 text-center border-r border-slate-200">${item.tgl_pinjam || '-'}</td>
                        <td class="px-4 py-2.5 text-slate-600 border-r border-slate-200">${item.ket || '-'}</td>
                    </tr>`;
                }).join('');

                tfootPiutang.innerHTML = `
                <tr>
                    <td colspan="2" class="px-4 py-3 text-center border-r border-rose-200">TOTAL PIUTANG AKTIF</td>
                    <td class="px-4 py-3 text-right text-rose-700 border-r border-rose-200">${fmt(totalPiutangAktif)}</td>
                    <td colspan="2" class="px-4 py-3 no-print"></td>
                </tr>`;
            }

            const labels = BULAN_LIST.map(b => b.slice(0, 3));
            const dataIWB = BULAN_LIST.map(m => (iwbData[m] || []).reduce((sum, item) => sum + (item.tot_iuran || 0), 0));
            const dataITB = BULAN_LIST.map(m => (itbData[m] || []).reduce((sum, item) => sum + (item.nominal || 0), 0));
            const dataSS = BULAN_LIST.map(m => (ssData[m] || []).reduce((sum, item) => sum + (item.nominal || 0), 0));

            chartTren = new Chart(document.getElementById('chartTren'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'IWB', data: dataIWB, backgroundColor: '#10B981', borderRadius: 4 },
                        { label: 'ITB', data: dataITB, backgroundColor: '#F43F5E', borderRadius: 4 },
                        { label: 'SS', data: dataSS, backgroundColor: '#F59E0B', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true, ticks: { callback: v => 'Rp ' + new Intl.NumberFormat('id-ID').format(v) } } }
                }
            });

            chartProporsi = new Chart(document.getElementById('chartProporsi'), {
                type: 'doughnut',
                data: {
                    labels: ['IWB', 'ITB', 'SS'],
                    datasets: [{
                        data: [totalIWB, totalITB, totalSS],
                        backgroundColor: ['#10B981', '#F43F5E', '#F59E0B'],
                        borderWidth: 2, borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '60%',
                    plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` Rp ${fmt(c.parsed)}` } } }
                }
            });
        }

        // ==========================================
        // CRUD LOGIC (MODAL)
        // ==========================================
        function openAddModal() {
            if (!isEditor()) { showToast('Login dulu untuk menambah data.', true); openEditorLogin(); return; }
            
            document.getElementById('editIndex').value = "-1";
            document.getElementById('dataForm').reset();
            
            document.getElementById('form-iwb-fields').classList.add('hidden');
            document.getElementById('form-ssitb-fields').classList.add('hidden');
            document.getElementById('form-kas-fields').classList.add('hidden');
            document.getElementById('form-pinjaman-fields').classList.add('hidden');
            document.getElementById('form-bendahara-fields').classList.add('hidden');
            document.getElementById('form-ceklis-fields').classList.add('hidden');
            document.getElementById('form-nama-wrapper').classList.remove('hidden');
            document.getElementById('form-umum-fields').classList.remove('hidden');
            
            document.getElementById('inputTotalIWB').removeAttribute('required');
            document.getElementById('inputNominal').removeAttribute('required');

            if (activeTab === 'iwb') {
                document.getElementById('form-iwb-fields').classList.remove('hidden');
                document.getElementById('inputTotalIWB').setAttribute('required', 'true');
                document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-plus-circle"></i> Tambah Data IWB`;
                previewIWB();
            } else if (activeTab === 'ss' || activeTab === 'itb') {
                document.getElementById('form-ssitb-fields').classList.remove('hidden');
                document.getElementById('inputNominal').setAttribute('required', 'true');
                if (activeTab === 'ss') {
                    document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-plus-circle"></i> Tambah Sumbangan Sukarela`;
                    document.getElementById('labelNominal').textContent = "Nominal Sumbangan (Rp)";
                } else {
                    document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-plus-circle"></i> Tambah Iuran ITB`;
                    document.getElementById('labelNominal').textContent = "Nominal ITB (Rp)";
                }
            } else if (activeTab === 'kas') {
                document.getElementById('form-kas-fields').classList.remove('hidden');
                document.getElementById('form-nama-wrapper').classList.add('hidden');
                document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-plus-circle"></i> Tambah Transaksi Kas`;
            } else if (activeTab === 'pinjaman') {
                document.getElementById('form-pinjaman-fields').classList.remove('hidden');
                document.getElementById('form-umum-fields').classList.add('hidden');
                document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-plus-circle"></i> Tambah Pinjaman`;
                handleStatusPinjamanChange('Belum');
            } else if (activeTab === 'bendahara') {
                document.getElementById('form-bendahara-fields').classList.remove('hidden');
                document.getElementById('form-nama-wrapper').classList.add('hidden');
                document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-plus-circle"></i> Tambah Catatan Bendahara`;
            }
            
            document.getElementById('dataModal').classList.remove('hidden');
        }

        function openEditModal(idx) {
            if (!isEditor()) { showToast('Login dulu untuk mengedit data.', true); return; }
            const dataBulanIni = appStore[activeTab][selectedTahun][selectedBulan];
            const item = dataBulanIni[idx];
            
            document.getElementById('editIndex').value = idx;
            document.getElementById('inputKet').value = item.ket || '';

            document.getElementById('form-iwb-fields').classList.add('hidden');
            document.getElementById('form-ssitb-fields').classList.add('hidden');
            document.getElementById('form-kas-fields').classList.add('hidden');
            document.getElementById('form-pinjaman-fields').classList.add('hidden');
            document.getElementById('form-bendahara-fields').classList.add('hidden');
            document.getElementById('form-nama-wrapper').classList.remove('hidden');
            document.getElementById('form-umum-fields').classList.remove('hidden');

            if (activeTab === 'iwb') {
                document.getElementById('inputNama').value = item.nama;
                document.getElementById('form-iwb-fields').classList.remove('hidden');
                document.getElementById('inputTotalIWB').value = fmt(item.tot_iuran);
                document.getElementById('inputTanggal').value = item.tanggal || '';
                document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Data IWB`;
                previewIWB();
            } else if (activeTab === 'ss' || activeTab === 'itb') {
                document.getElementById('inputNama').value = item.nama;
                document.getElementById('form-ssitb-fields').classList.remove('hidden');
                document.getElementById('inputNominal').value = fmt(item.nominal);
                document.getElementById('inputSetor').value = fmt(item.setor);
                document.getElementById('inputTanggal').value = item.tanggal || '';
                
                if (activeTab === 'ss') {
                    document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Sumbangan Sukarela`;
                    document.getElementById('labelNominal').textContent = "Nominal Sumbangan (Rp)";
                } else {
                    document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Iuran ITB`;
                    document.getElementById('labelNominal').textContent = "Nominal ITB (Rp)";
                }
            } else if (activeTab === 'kas') {
                document.getElementById('form-kas-fields').classList.remove('hidden');
                document.getElementById('form-nama-wrapper').classList.add('hidden');
                document.getElementById('inputMasuk').value = fmt(item.masuk);
                document.getElementById('inputKeluar').value = fmt(item.keluar);
                document.getElementById('inputTanggal').value = item.tanggal || '';
                document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Transaksi Kas`;
            } else if (activeTab === 'pinjaman') {
                document.getElementById('form-pinjaman-fields').classList.remove('hidden');
                document.getElementById('form-umum-fields').classList.add('hidden');
                document.getElementById('inputNama').value = item.nama;
                document.getElementById('inputNominalPinjam').value = fmt(item.nominal);
                document.getElementById('inputTglPinjam').value = item.tgl_pinjam || '';
                document.getElementById('inputStatusPinjam').value = item.status;
                document.getElementById('inputTglBayar').value = item.tgl_bayar || '';
                handleStatusPinjamanChange(item.status);
                document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Pinjaman`;
            } else if (activeTab === 'bendahara') {
                document.getElementById('form-bendahara-fields').classList.remove('hidden');
                document.getElementById('form-nama-wrapper').classList.add('hidden');
                document.getElementById('inputMasukBendahara').value = fmt(item.masuk);
                document.getElementById('inputKeluarBendahara').value = fmt(item.keluar);
                document.getElementById('inputCatatanBendahara').value = item.catatan || '';
                document.getElementById('inputTanggal').value = item.tanggal || '';
                document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Catatan Bendahara`;
            }
            
            document.getElementById('dataModal').classList.remove('hidden');
        }

        function openEditCeklisModal(idx) {
            if (!isEditor()) { showToast('Login dulu untuk mengedit data.', true); return; }
            const data = generateAutoCeklis();
            const item = data[idx];
            
            document.getElementById('editIndex').value = idx;
            document.getElementById('inputKet').value = item.ket || '';

            document.getElementById('form-iwb-fields').classList.add('hidden');
            document.getElementById('form-ssitb-fields').classList.add('hidden');
            document.getElementById('form-kas-fields').classList.add('hidden');
            document.getElementById('form-pinjaman-fields').classList.add('hidden');
            document.getElementById('form-bendahara-fields').classList.add('hidden');
            document.getElementById('form-nama-wrapper').classList.add('hidden');
            document.getElementById('form-umum-fields').classList.add('hidden');
            document.getElementById('form-ceklis-fields').classList.remove('hidden');

            document.getElementById('modalTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Keterangan Ceklis`;
            document.getElementById('dataModal').classList.remove('hidden');
        }

        function deleteCeklisKeterangan(idx) {
            if (!isEditor()) { showToast('Login dulu untuk menghapus data.', true); return; }
            const data = generateAutoCeklis();
            const nama = data[idx].nama;
            
            if (!appStore.ceklis[selectedTahun]) appStore.ceklis[selectedTahun] = {};
            if (!appStore.ceklis[selectedTahun][selectedBulan]) appStore.ceklis[selectedTahun][selectedBulan] = [];
            
            const customData = appStore.ceklis[selectedTahun][selectedBulan];
            const existingIdx = customData.findIndex(x => x.nama === nama);
            
            if (existingIdx !== -1) {
                customData.splice(existingIdx, 1); 
                saveToLocal();
                renderTable();
            }
        }

        function closeModal() {
            document.getElementById('dataModal').classList.add('hidden');
        }

        function previewIWB() {
            const val = cleanNumber(document.getElementById('inputTotalIWB').value);
            const { dpw, dpd, dpc, upa, setor } = splitIWB(val);
            document.getElementById('iwbPreview').innerHTML = `
                <p>DPW (15%): Rp ${fmt(dpw)} | DPD (30%): Rp ${fmt(dpd)} | DPC (30%): Rp ${fmt(dpc)}</p>
                <p class="font-black text-slate-900">UPA (25%): Rp ${fmt(upa)} | <span class="text-emerald-600">Setor (75%): Rp ${fmt(setor)}</span></p>
            `;
        }

        function saveData(e) {
            e.preventDefault();
            if (!isEditor()) return;
            const idx = parseInt(document.getElementById('editIndex').value);
            const ket = document.getElementById('inputKet').value;

            if (activeTab === 'ceklis') {
                const autoData = generateAutoCeklis();
                const nama = autoData[idx].nama;

                if (!appStore.ceklis[selectedTahun]) appStore.ceklis[selectedTahun] = {};
                if (!appStore.ceklis[selectedTahun][selectedBulan]) appStore.ceklis[selectedTahun][selectedBulan] = [];
                
                const customData = appStore.ceklis[selectedTahun][selectedBulan];
                const existingIdx = customData.findIndex(x => x.nama === nama);
                
                if (existingIdx !== -1) {
                    customData[existingIdx].ket = ket;
                } else {
                    customData.push({ nama: nama, ket: ket });
                }

                saveToLocal();
                renderTable();
                closeModal();
                return;
            }

            if (!appStore[activeTab][selectedTahun]) appStore[activeTab][selectedTahun] = {};
            if (!appStore[activeTab][selectedTahun][selectedBulan]) appStore[activeTab][selectedTahun][selectedBulan] = [];

            const dataBulanIni = appStore[activeTab][selectedTahun][selectedBulan];

            if (activeTab === 'iwb') {
                const nama = document.getElementById('inputNama').value;
                const tot_iuran = cleanNumber(document.getElementById('inputTotalIWB').value);
                const tanggal = document.getElementById('inputTanggal').value;
                if (idx === -1) {
                    dataBulanIni.push({ id: Date.now(), nama, tot_iuran, tanggal, ket });
                } else {
                    dataBulanIni[idx] = { ...dataBulanIni[idx], nama, tot_iuran, tanggal, ket };
                }
            } else if (activeTab === 'ss' || activeTab === 'itb') {
                const nama = document.getElementById('inputNama').value;
                const nominal = cleanNumber(document.getElementById('inputNominal').value);
                const setor = cleanNumber(document.getElementById('inputSetor').value);
                const tanggal = document.getElementById('inputTanggal').value;
                if (idx === -1) {
                    dataBulanIni.push({ id: Date.now(), nama, nominal, setor, tanggal, ket });
                } else {
                    dataBulanIni[idx] = { ...dataBulanIni[idx], nama, nominal, setor, tanggal, ket };
                }
            } else if (activeTab === 'kas') {
                const masuk = cleanNumber(document.getElementById('inputMasuk').value);
                const keluar = cleanNumber(document.getElementById('inputKeluar').value);
                const tanggal = document.getElementById('inputTanggal').value;
                if (idx === -1) {
                    dataBulanIni.push({ id: Date.now(), tanggal, ket, masuk, keluar });
                } else {
                    dataBulanIni[idx] = { ...dataBulanIni[idx], tanggal, ket, masuk, keluar };
                }
            } else if (activeTab === 'pinjaman') {
                const nama = document.getElementById('inputNama').value;
                const nominal = cleanNumber(document.getElementById('inputNominalPinjam').value);
                const tgl_pinjam = document.getElementById('inputTglPinjam').value;
                const status = document.getElementById('inputStatusPinjam').value;
                const tgl_bayar = status === "Lunas" ? document.getElementById('inputTglBayar').value : "";
                
                if (idx === -1) {
                    dataBulanIni.push({ id: Date.now(), nama, nominal, tgl_pinjam, tgl_bayar, status, ket });
                } else {
                    dataBulanIni[idx] = { ...dataBulanIni[idx], nama, nominal, tgl_pinjam, tgl_bayar, status, ket };
                }
            } else if (activeTab === 'bendahara') {
                const masuk = cleanNumber(document.getElementById('inputMasukBendahara').value);
                const keluar = cleanNumber(document.getElementById('inputKeluarBendahara').value);
                const catatan = document.getElementById('inputCatatanBendahara').value;
                const tanggal = document.getElementById('inputTanggal').value;
                if (idx === -1) {
                    dataBulanIni.push({ id: Date.now(), tanggal, ket, masuk, keluar, catatan });
                } else {
                    dataBulanIni[idx] = { ...dataBulanIni[idx], tanggal, ket, masuk, keluar, catatan };
                }
            }

            saveToLocal();
            renderTable();
            closeModal();
        }

        // ==========================================
        // DELETE LOGIC
        // ==========================================
        function openDeleteModal(idx) {
            if (!isEditor()) { showToast('Login dulu untuk menghapus data.', true); return; }
            deleteIndex = idx;
            document.getElementById('deleteModal').classList.remove('hidden');
        }

        function closeDeleteModal() {
            document.getElementById('deleteModal').classList.add('hidden');
            deleteIndex = -1;
        }

        function executeDelete() {
            if (!isEditor()) return;
            if (deleteIndex !== -1) {
                const dataBulanIni = appStore[activeTab][selectedTahun][selectedBulan];
                dataBulanIni.splice(deleteIndex, 1);
                saveToLocal();
                renderTable();
            }
            closeDeleteModal();
        }

        // ==========================================
        // SETTINGS (BACKUP/RESTORE)
        // ==========================================
        function openSettingsModal() {
            if (!isEditor()) { showToast('Login dulu untuk membuka Pengaturan Data.', true); return; }
            document.getElementById('settingsModal').classList.remove('hidden');
        }
        function closeSettingsModal() { document.getElementById('settingsModal').classList.add('hidden'); }
        function openResetModal() {
            if (!isEditor()) { showToast('Login dulu untuk reset data.', true); return; }
            document.getElementById('resetModal').classList.remove('hidden');
        }
        function closeResetModal() { document.getElementById('resetModal').classList.add('hidden'); }
        function executeResetData() {
            if (!isEditor()) return;
            initDefaultStore();
            renderTable();
            closeResetModal();
            closeSettingsModal();
            showToast("Data berhasil direset ke kondisi awal!");
        }
        function exportDataJSON() {
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = now.getFullYear();
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const timeStamp = `${dd}-${mm}-${yyyy}_${hh}${min}`;
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appStore, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `UPA_3216M010_Backup_${timeStamp}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            showToast("File backup berhasil diunduh!");
        }
        function importDataJSON(event) {
            if (!isEditor()) { showToast('Login dulu untuk import data.', true); event.target.value = ''; return; }
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (imported && typeof imported === 'object' && Object.keys(imported).length > 0) {
                        appStore = normalizeStore(imported);
                        saveToLocal();
                        renderTable();
                        closeSettingsModal();
                        showToast("Data backup berhasil dipulihkan!");
                    } else showToast("Format file backup tidak valid!", true);
                } catch (err) { showToast("Gagal membaca file JSON!", true); }
            };
            reader.readAsText(file);
        }

        // ==========================================
        // INISIALISASI AWAL & FIREBASE AUTH
        // ==========================================
        document.addEventListener('DOMContentLoaded', () => {
            populateYearOptions();
            loadData();
            updatePeriodLabels();
            applyAuthUI();
            switchTab('iwb'); 
            appInitialized = true;
            startCloudSync();
        });

        firebaseAuth.onAuthStateChanged(async (user) => {
            if (user && !isAuthorizedEditor(user)) {
                try { await firebaseAuth.signOut(); } catch (error) {}
                applyAuthUI();
                showToast('Akun Firebase ini tidak terdaftar sebagai editor aplikasi.', true);
                if (appInitialized) startCloudSync();
                return;
            }
            applyAuthUI();
            if (appInitialized) startCloudSync();
        });