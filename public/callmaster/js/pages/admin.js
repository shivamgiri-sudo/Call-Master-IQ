// public/callmaster/js/pages/admin.js

const ADMIN_PAGES = {

  // ─────────────────────────────────────────────────────────────
  // 1. User Management
  // ─────────────────────────────────────────────────────────────
  'admin-users': async function() {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/users');
    const rows = r.data || [];
    return `
      ${pageHeader('User Management', 'Create and manage system users')}
      <div style="margin-bottom:16px">
        <button class="btn btn-primary" onclick="adminShowCreateUser()">+ New User</button>
      </div>
      ${table(
        [
          { key: 'user_id',    label: 'ID' },
          { key: 'username',   label: 'Username' },
          { key: 'full_name',  label: 'Full Name' },
          { key: 'role',       label: 'Role',   render: v => `<span class="badge badge-blue">${v || '—'}</span>` },
          { key: 'is_active',  label: 'Status', render: v => v ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>' },
          { key: 'user_id',    label: 'Actions', render: (id, row) => `
            <button class="btn" style="padding:2px 8px;font-size:12px" onclick="adminResetPwd(${id})">Reset Pwd</button>
            ${row.is_active ? `<button class="btn" style="padding:2px 8px;font-size:12px;margin-left:4px;color:var(--danger)" onclick="adminDeactivate(${id})">Deactivate</button>` : ''}
          ` },
        ],
        rows,
        { emptyMsg: 'No users found' }
      )}

      <div id="createUserModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Create User</div>
          <div class="form-group"><label class="form-label">Username</label><input class="filter-input" id="uUsername" placeholder="e.g. john.doe"></div>
          <div class="form-group"><label class="form-label">Full Name</label><input class="filter-input" id="uFullName" placeholder="John Doe"></div>
          <div class="form-group"><label class="form-label">Password</label><input class="filter-input" type="password" id="uPassword"></div>
          <div class="form-group"><label class="form-label">Role</label>
            <select class="filter-input" id="uRole">
              <option value="admin">admin</option>
              <option value="ceo">ceo</option>
              <option value="tq_head">tq_head</option>
              <option value="branch_manager">branch_manager</option>
              <option value="process_manager">process_manager</option>
              <option value="analyst">analyst</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Employee Code (optional)</label><input class="filter-input" id="uEmpCode" placeholder="EMP001"></div>
          <div id="createUserErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitCreateUser()">Create</button>
            <button class="btn" onclick="document.getElementById('createUserModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <div id="resetPwdModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Reset Password</div>
          <input type="hidden" id="resetPwdUserId">
          <div class="form-group"><label class="form-label">New Password</label><input class="filter-input" type="password" id="resetPwdVal"></div>
          <div id="resetPwdErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitResetPwd()">Reset</button>
            <button class="btn" onclick="document.getElementById('resetPwdModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <script>
        function adminShowCreateUser() { document.getElementById('createUserModal').style.display='flex'; document.getElementById('createUserErr').textContent=''; }
        async function adminSubmitCreateUser() {
          const body = {
            username: document.getElementById('uUsername').value.trim(),
            full_name: document.getElementById('uFullName').value.trim(),
            password: document.getElementById('uPassword').value,
            role: document.getElementById('uRole').value,
            employee_code: document.getElementById('uEmpCode').value.trim() || null,
          };
          if (!body.username || !body.full_name || !body.password) { document.getElementById('createUserErr').textContent = 'Username, full name and password are required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/users', body);
          if (r.success) { toast('User created', 'success'); document.getElementById('createUserModal').style.display='none'; go('admin-users'); }
          else { document.getElementById('createUserErr').textContent = r.message || 'Failed to create user'; }
        }
        function adminResetPwd(id) { document.getElementById('resetPwdUserId').value = id; document.getElementById('resetPwdVal').value = ''; document.getElementById('resetPwdErr').textContent=''; document.getElementById('resetPwdModal').style.display='flex'; }
        async function adminSubmitResetPwd() {
          const id = document.getElementById('resetPwdUserId').value;
          const pwd = document.getElementById('resetPwdVal').value;
          if (!pwd) { document.getElementById('resetPwdErr').textContent = 'Password required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/users/' + id + '/reset-password', { new_password: pwd });
          if (r.success) { toast('Password reset', 'success'); document.getElementById('resetPwdModal').style.display='none'; }
          else { document.getElementById('resetPwdErr').textContent = r.message || 'Failed'; }
        }
        async function adminDeactivate(id) {
          if (!confirm('Deactivate user #' + id + '?')) return;
          const r = await CALLMASTER_API.post('/api/callmaster/admin/users/' + id + '/deactivate', {});
          r.success ? (toast('User deactivated', 'success'), go('admin-users')) : toast(r.message || 'Failed', 'error');
        }
      <\/script>`;
  },

  // ─────────────────────────────────────────────────────────────
  // 2. Employee Management
  // ─────────────────────────────────────────────────────────────
  'admin-employees': async function() {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/employees');
    const rows = r.data || [];
    return `
      ${pageHeader('Employee Management', 'Manage employee master records')}
      <div style="margin-bottom:16px;display:flex;gap:8px">
        <button class="btn btn-primary" onclick="adminShowCreateEmp()">+ New Employee</button>
        <button class="btn" onclick="adminShowBulkEmp()">Bulk Import CSV</button>
      </div>
      ${table(
        [
          { key: 'employee_code', label: 'Employee Code' },
          { key: 'full_name',     label: 'Full Name' },
          { key: 'designation',   label: 'Designation' },
          { key: 'branch_name',   label: 'Branch' },
          { key: 'process_name',  label: 'Process' },
          { key: 'is_active',     label: 'Status', render: v => v || v === 1 ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>' },
          { key: 'employee_id',   label: 'Actions', render: (id, row) => `
            <button class="btn" style="padding:2px 8px;font-size:12px" onclick="adminEditEmp(${JSON.stringify(row).split('"').join('&quot;')})">Edit</button>
            <button class="btn" style="padding:2px 8px;font-size:12px;margin-left:4px;color:var(--danger)" onclick="adminDeleteEmp(${id})">Delete</button>
          ` },
        ],
        rows,
        { emptyMsg: 'No employees found' }
      )}

      <div id="createEmpModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title" id="createEmpTitle">Add Employee</div>
          <input type="hidden" id="empEditId">
          <div class="form-group"><label class="form-label">Employee Code *</label><input class="filter-input" id="empCode" placeholder="EMP001"></div>
          <div class="form-group"><label class="form-label">Full Name *</label><input class="filter-input" id="empFullName"></div>
          <div class="form-group"><label class="form-label">Designation</label><input class="filter-input" id="empDesig"></div>
          <div class="form-group"><label class="form-label">Branch Name</label><input class="filter-input" id="empBranch"></div>
          <div class="form-group"><label class="form-label">Process Name</label><input class="filter-input" id="empProcess"></div>
          <div id="createEmpErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitEmp()">Save</button>
            <button class="btn" onclick="document.getElementById('createEmpModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <div id="bulkEmpModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Bulk Import Employees</div>
          <div class="form-group"><label class="form-label">CSV Data (employee_code,full_name,designation,branch_name,process_name)</label>
            <textarea class="filter-input" id="bulkEmpCsv" rows="8" style="width:100%;font-family:monospace;font-size:12px" placeholder="EMP001,John Doe,Agent,Delhi NCR,GNC Inbound"></textarea>
          </div>
          <div id="bulkEmpErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitBulkEmp()">Import</button>
            <button class="btn" onclick="document.getElementById('bulkEmpModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <script>
        function adminShowCreateEmp() {
          document.getElementById('createEmpTitle').textContent = 'Add Employee';
          document.getElementById('empEditId').value = '';
          ['empCode','empFullName','empDesig','empBranch','empProcess'].forEach(id => document.getElementById(id).value = '');
          document.getElementById('createEmpErr').textContent = '';
          document.getElementById('createEmpModal').style.display = 'flex';
        }
        function adminEditEmp(row) {
          document.getElementById('createEmpTitle').textContent = 'Edit Employee';
          document.getElementById('empEditId').value = row.employee_id || '';
          document.getElementById('empCode').value = row.employee_code || '';
          document.getElementById('empFullName').value = row.full_name || '';
          document.getElementById('empDesig').value = row.designation || '';
          document.getElementById('empBranch').value = row.branch_name || '';
          document.getElementById('empProcess').value = row.process_name || '';
          document.getElementById('createEmpErr').textContent = '';
          document.getElementById('createEmpModal').style.display = 'flex';
        }
        async function adminSubmitEmp() {
          const id = document.getElementById('empEditId').value;
          const body = {
            employee_code: document.getElementById('empCode').value.trim(),
            full_name: document.getElementById('empFullName').value.trim(),
            designation: document.getElementById('empDesig').value.trim(),
            branch_name: document.getElementById('empBranch').value.trim(),
            process_name: document.getElementById('empProcess').value.trim(),
          };
          if (!body.employee_code || !body.full_name) { document.getElementById('createEmpErr').textContent = 'Employee code and full name are required'; return; }
          const r = id
            ? await CALLMASTER_API.put('/api/callmaster/admin/employees/' + id, body)
            : await CALLMASTER_API.post('/api/callmaster/admin/employees', body);
          if (r.success) { toast(id ? 'Employee updated' : 'Employee created', 'success'); document.getElementById('createEmpModal').style.display='none'; go('admin-employees'); }
          else { document.getElementById('createEmpErr').textContent = r.message || 'Failed'; }
        }
        async function adminDeleteEmp(id) {
          if (!confirm('Delete employee #' + id + '?')) return;
          const r = await CALLMASTER_API.delete('/api/callmaster/admin/employees/' + id);
          r.success ? (toast('Employee deleted', 'success'), go('admin-employees')) : toast(r.message || 'Failed', 'error');
        }
        function adminShowBulkEmp() { document.getElementById('bulkEmpCsv').value = ''; document.getElementById('bulkEmpErr').textContent = ''; document.getElementById('bulkEmpModal').style.display='flex'; }
        async function adminSubmitBulkEmp() {
          const csv = document.getElementById('bulkEmpCsv').value.trim();
          if (!csv) { document.getElementById('bulkEmpErr').textContent = 'CSV data required'; return; }
          const lines = csv.split('\\n').filter(l => l.trim());
          const records = lines.map(l => { const [employee_code,full_name,designation,branch_name,process_name] = l.split(',').map(s=>s.trim()); return {employee_code,full_name,designation,branch_name,process_name}; });
          const r = await CALLMASTER_API.post('/api/callmaster/admin/employees/bulk-import', { records });
          if (r.success) { toast('Bulk import done', 'success'); document.getElementById('bulkEmpModal').style.display='none'; go('admin-employees'); }
          else { document.getElementById('bulkEmpErr').textContent = r.message || 'Import failed'; }
        }
      <\/script>`;
  },

  // ─────────────────────────────────────────────────────────────
  // 3. Agent Alias Mapping
  // ─────────────────────────────────────────────────────────────
  'admin-aliases': async function() {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/aliases');
    const rows = r.data || [];
    return `
      ${pageHeader('Agent Alias Mapping', 'Map system agent codes to employee records')}
      <div style="margin-bottom:16px;display:flex;gap:8px">
        <button class="btn btn-primary" onclick="adminShowCreateAlias()">+ New Alias</button>
        <button class="btn" onclick="adminShowBulkAlias()">Bulk Import CSV</button>
      </div>
      ${table(
        [
          { key: 'alias_id',       label: 'ID' },
          { key: 'agent_alias',    label: 'Agent Alias (source)' },
          { key: 'employee_code',  label: 'Employee Code' },
          { key: 'source_type',    label: 'Source Type', render: v => v ? `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` : '—' },
          { key: 'alias_id',       label: 'Actions', render: (id, row) => `
            <button class="btn" style="padding:2px 8px;font-size:12px" onclick='adminEditAlias(${JSON.stringify(row).split("'").join("&#39;")})'>Edit</button>
            <button class="btn" style="padding:2px 8px;font-size:12px;margin-left:4px;color:var(--danger)" onclick="adminDeleteAlias(${id})">Delete</button>
          ` },
        ],
        rows,
        { emptyMsg: 'No alias mappings found' }
      )}

      <div id="createAliasModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title" id="aliasModalTitle">Add Alias Mapping</div>
          <input type="hidden" id="aliasEditId">
          <div class="form-group"><label class="form-label">Agent Alias *</label><input class="filter-input" id="aliasAgentAlias" placeholder="e.g. JOHN_D"></div>
          <div class="form-group"><label class="form-label">Employee Code *</label><input class="filter-input" id="aliasEmpCode" placeholder="EMP001"></div>
          <div class="form-group"><label class="form-label">Source Type</label>
            <select class="filter-input" id="aliasSourceType">
              <option value="">-- Select --</option>
              <option value="Inbound">Inbound</option>
              <option value="Outbound">Outbound</option>
            </select>
          </div>
          <div id="aliasErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitAlias()">Save</button>
            <button class="btn" onclick="document.getElementById('createAliasModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <div id="bulkAliasModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Bulk Import Aliases</div>
          <div class="form-group"><label class="form-label">CSV (agent_alias,employee_code,source_type)</label>
            <textarea class="filter-input" id="bulkAliasCsv" rows="8" style="width:100%;font-family:monospace;font-size:12px" placeholder="JOHN_D,EMP001,Inbound"></textarea>
          </div>
          <div id="bulkAliasErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitBulkAlias()">Import</button>
            <button class="btn" onclick="document.getElementById('bulkAliasModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <script>
        function adminShowCreateAlias() {
          document.getElementById('aliasModalTitle').textContent = 'Add Alias Mapping';
          document.getElementById('aliasEditId').value = '';
          document.getElementById('aliasAgentAlias').value = '';
          document.getElementById('aliasEmpCode').value = '';
          document.getElementById('aliasSourceType').value = '';
          document.getElementById('aliasErr').textContent = '';
          document.getElementById('createAliasModal').style.display = 'flex';
        }
        function adminEditAlias(row) {
          document.getElementById('aliasModalTitle').textContent = 'Edit Alias Mapping';
          document.getElementById('aliasEditId').value = row.alias_id || '';
          document.getElementById('aliasAgentAlias').value = row.agent_alias || '';
          document.getElementById('aliasEmpCode').value = row.employee_code || '';
          document.getElementById('aliasSourceType').value = row.source_type || '';
          document.getElementById('aliasErr').textContent = '';
          document.getElementById('createAliasModal').style.display = 'flex';
        }
        async function adminSubmitAlias() {
          const id = document.getElementById('aliasEditId').value;
          const body = {
            agent_alias: document.getElementById('aliasAgentAlias').value.trim(),
            employee_code: document.getElementById('aliasEmpCode').value.trim(),
            source_type: document.getElementById('aliasSourceType').value,
          };
          if (!body.agent_alias || !body.employee_code) { document.getElementById('aliasErr').textContent = 'Agent alias and employee code are required'; return; }
          const r = id
            ? await CALLMASTER_API.put('/api/callmaster/admin/aliases/' + id, body)
            : await CALLMASTER_API.post('/api/callmaster/admin/aliases', body);
          if (r.success) { toast(id ? 'Alias updated' : 'Alias created', 'success'); document.getElementById('createAliasModal').style.display='none'; go('admin-aliases'); }
          else { document.getElementById('aliasErr').textContent = r.message || 'Failed'; }
        }
        async function adminDeleteAlias(id) {
          if (!confirm('Delete alias #' + id + '?')) return;
          const r = await CALLMASTER_API.delete('/api/callmaster/admin/aliases/' + id);
          r.success ? (toast('Alias deleted', 'success'), go('admin-aliases')) : toast(r.message || 'Failed', 'error');
        }
        function adminShowBulkAlias() { document.getElementById('bulkAliasCsv').value = ''; document.getElementById('bulkAliasErr').textContent = ''; document.getElementById('bulkAliasModal').style.display='flex'; }
        async function adminSubmitBulkAlias() {
          const csv = document.getElementById('bulkAliasCsv').value.trim();
          if (!csv) { document.getElementById('bulkAliasErr').textContent = 'CSV data required'; return; }
          const lines = csv.split('\\n').filter(l => l.trim());
          const records = lines.map(l => { const [agent_alias,employee_code,source_type] = l.split(',').map(s=>s.trim()); return {agent_alias,employee_code,source_type}; });
          const r = await CALLMASTER_API.post('/api/callmaster/admin/aliases/bulk-import', { records });
          if (r.success) { toast('Bulk import done', 'success'); document.getElementById('bulkAliasModal').style.display='none'; go('admin-aliases'); }
          else { document.getElementById('bulkAliasErr').textContent = r.message || 'Import failed'; }
        }
      <\/script>`;
  },

  // ─────────────────────────────────────────────────────────────
  // 4. Process Configuration
  // ─────────────────────────────────────────────────────────────
  'admin-processes': async function() {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/processes');
    const rows = r.data || [];
    return `
      ${pageHeader('Process Configuration', 'Configure inbound and outbound call processes')}
      <div style="margin-bottom:16px">
        <button class="btn btn-primary" onclick="adminShowCreateProcess()">+ New Process</button>
      </div>
      ${table(
        [
          { key: 'process_id',   label: 'ID' },
          { key: 'process_name', label: 'Process Name' },
          { key: 'source_type',  label: 'Type', render: v => v ? `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` : '—' },
          { key: 'source_db',    label: 'Source DB' },
          { key: 'source_table', label: 'Source Table' },
          { key: 'sla_target',   label: 'SLA Target', render: v => v != null ? `${v}%` : '—' },
          { key: 'is_active',    label: 'Status', render: v => v || v === 1 ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>' },
          { key: 'process_id',   label: 'Actions', render: (id, row) => `
            <button class="btn" style="padding:2px 8px;font-size:12px" onclick='adminEditProcess(${JSON.stringify(row).split("'").join("&#39;")})'>Edit</button>
            <button class="btn" style="padding:2px 8px;font-size:12px;margin-left:4px;color:var(--danger)" onclick="adminDeleteProcess(${id})">Delete</button>
          ` },
        ],
        rows,
        { emptyMsg: 'No processes configured' }
      )}

      <div id="createProcessModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title" id="processModalTitle">Add Process</div>
          <input type="hidden" id="processEditId">
          <div class="form-group"><label class="form-label">Process Name *</label><input class="filter-input" id="procName" placeholder="GNC Inbound"></div>
          <div class="form-group"><label class="form-label">Source Type *</label>
            <select class="filter-input" id="procSourceType">
              <option value="Inbound">Inbound</option>
              <option value="Outbound">Outbound</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Source DB</label><input class="filter-input" id="procSourceDb" placeholder="shivamgiri"></div>
          <div class="form-group"><label class="form-label">Source Table</label><input class="filter-input" id="procSourceTable" placeholder="inbound_calls"></div>
          <div class="form-group"><label class="form-label">SLA Target (%)</label><input class="filter-input" type="number" id="procSlaTarget" placeholder="85"></div>
          <div class="form-group"><label class="form-label">Active</label>
            <select class="filter-input" id="procActive">
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
          <div id="processErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitProcess()">Save</button>
            <button class="btn" onclick="document.getElementById('createProcessModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <script>
        function adminShowCreateProcess() {
          document.getElementById('processModalTitle').textContent = 'Add Process';
          document.getElementById('processEditId').value = '';
          ['procName','procSourceDb','procSourceTable','procSlaTarget'].forEach(id => document.getElementById(id).value = '');
          document.getElementById('procSourceType').value = 'Inbound';
          document.getElementById('procActive').value = '1';
          document.getElementById('processErr').textContent = '';
          document.getElementById('createProcessModal').style.display = 'flex';
        }
        function adminEditProcess(row) {
          document.getElementById('processModalTitle').textContent = 'Edit Process';
          document.getElementById('processEditId').value = row.process_id || '';
          document.getElementById('procName').value = row.process_name || '';
          document.getElementById('procSourceType').value = row.source_type || 'Inbound';
          document.getElementById('procSourceDb').value = row.source_db || '';
          document.getElementById('procSourceTable').value = row.source_table || '';
          document.getElementById('procSlaTarget').value = row.sla_target || '';
          document.getElementById('procActive').value = (row.is_active || row.is_active === 1) ? '1' : '0';
          document.getElementById('processErr').textContent = '';
          document.getElementById('createProcessModal').style.display = 'flex';
        }
        async function adminSubmitProcess() {
          const id = document.getElementById('processEditId').value;
          const sla = document.getElementById('procSlaTarget').value;
          const body = {
            process_name: document.getElementById('procName').value.trim(),
            source_type: document.getElementById('procSourceType').value,
            source_db: document.getElementById('procSourceDb').value.trim(),
            source_table: document.getElementById('procSourceTable').value.trim(),
            sla_target: sla ? Number(sla) : null,
            is_active: document.getElementById('procActive').value === '1',
          };
          if (!body.process_name) { document.getElementById('processErr').textContent = 'Process name is required'; return; }
          const r = id
            ? await CALLMASTER_API.put('/api/callmaster/admin/processes/' + id, body)
            : await CALLMASTER_API.post('/api/callmaster/admin/processes', body);
          if (r.success) { toast(id ? 'Process updated' : 'Process created', 'success'); document.getElementById('createProcessModal').style.display='none'; go('admin-processes'); }
          else { document.getElementById('processErr').textContent = r.message || 'Failed'; }
        }
        async function adminDeleteProcess(id) {
          if (!confirm('Delete process #' + id + '?')) return;
          const r = await CALLMASTER_API.delete('/api/callmaster/admin/processes/' + id);
          r.success ? (toast('Process deleted', 'success'), go('admin-processes')) : toast(r.message || 'Failed', 'error');
        }
      <\/script>`;
  },

  // ─────────────────────────────────────────────────────────────
  // 5. Exclusion Rules
  // ─────────────────────────────────────────────────────────────
  'admin-exclusions': async function() {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/exclusions');
    const rows = r.data || [];
    return `
      ${pageHeader('Exclusion Rules', 'Block entire clients from dashboard reporting')}
      <div style="margin-bottom:16px">
        <button class="btn btn-primary" onclick="adminShowCreateExclusion()">+ New Exclusion Rule</button>
      </div>
      ${table(
        [
          { key: 'exclusion_id',    label: 'ID' },
          { key: 'source_db',       label: 'Source DB' },
          { key: 'source_table',    label: 'Source Table' },
          { key: 'source_type',     label: 'Type', render: v => v ? `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` : '—' },
          { key: 'client_id',       label: 'Client ID' },
          { key: 'campaign_id',     label: 'Campaign ID', render: v => v || '(all)' },
          { key: 'exclusion_reason',label: 'Reason' },
          { key: 'active_status',   label: 'Status', render: v => v || v === 1 ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>' },
          { key: 'exclusion_id',    label: 'Actions', render: (id) => `
            <button class="btn" style="padding:2px 8px;font-size:12px;color:var(--danger)" onclick="adminDeleteExclusion(${id})">Delete</button>
          ` },
        ],
        rows,
        { emptyMsg: 'No exclusion rules configured' }
      )}

      <div id="createExclusionModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Add Exclusion Rule</div>
          <div class="form-group"><label class="form-label">Source DB *</label><input class="filter-input" id="excSourceDb" placeholder="shivamgiri"></div>
          <div class="form-group"><label class="form-label">Source Table *</label><input class="filter-input" id="excSourceTable" placeholder="inbound_calls"></div>
          <div class="form-group"><label class="form-label">Source Type</label>
            <select class="filter-input" id="excSourceType">
              <option value="">-- Select --</option>
              <option value="Inbound">Inbound</option>
              <option value="Outbound">Outbound</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Client ID *</label><input class="filter-input" id="excClientId" placeholder="CLIENT_001"></div>
          <div class="form-group"><label class="form-label">Campaign ID (optional)</label><input class="filter-input" id="excCampaignId" placeholder="Leave blank to exclude all campaigns"></div>
          <div class="form-group"><label class="form-label">Exclusion Reason</label><input class="filter-input" id="excReason" placeholder="Test data / excluded account"></div>
          <div id="exclusionErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitExclusion()">Create</button>
            <button class="btn" onclick="document.getElementById('createExclusionModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <script>
        function adminShowCreateExclusion() {
          ['excSourceDb','excSourceTable','excClientId','excCampaignId','excReason'].forEach(id => document.getElementById(id).value = '');
          document.getElementById('excSourceType').value = '';
          document.getElementById('exclusionErr').textContent = '';
          document.getElementById('createExclusionModal').style.display = 'flex';
        }
        async function adminSubmitExclusion() {
          const body = {
            source_db: document.getElementById('excSourceDb').value.trim(),
            source_table: document.getElementById('excSourceTable').value.trim(),
            source_type: document.getElementById('excSourceType').value || null,
            client_id: document.getElementById('excClientId').value.trim(),
            campaign_id: document.getElementById('excCampaignId').value.trim() || null,
            exclusion_reason: document.getElementById('excReason').value.trim() || null,
          };
          if (!body.source_db || !body.source_table || !body.client_id) { document.getElementById('exclusionErr').textContent = 'Source DB, source table and client ID are required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/exclusions', body);
          if (r.success) { toast('Exclusion rule created', 'success'); document.getElementById('createExclusionModal').style.display='none'; go('admin-exclusions'); }
          else { document.getElementById('exclusionErr').textContent = r.message || 'Failed'; }
        }
        async function adminDeleteExclusion(id) {
          if (!confirm('Delete exclusion rule #' + id + '?')) return;
          const r = await CALLMASTER_API.delete('/api/callmaster/admin/exclusions/' + id);
          r.success ? (toast('Rule deleted', 'success'), go('admin-exclusions')) : toast(r.message || 'Failed', 'error');
        }
      <\/script>`;
  },

  // ─────────────────────────────────────────────────────────────
  // 6. Coaching Queue
  // ─────────────────────────────────────────────────────────────
  'admin-coaching': async function() {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/coaching');
    const rows = r.data || [];
    const openCount = rows.filter(x => x.status === 'Open' || x.status === 'open' || !x.closed_at).length;
    return `
      ${pageHeader('Coaching Queue', 'Manage and close coaching items')}
      <div class="kpi-grid" style="margin-bottom:20px">
        ${kpi('Total Items', rows.length)}
        ${kpi('Open', openCount, '', openCount > 0 ? 'down' : 'up')}
        ${kpi('Closed', rows.length - openCount, '', 'up')}
      </div>
      <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
        <button class="btn btn-primary" onclick="adminShowCreateCoaching()">+ New Coaching Item</button>
        <button class="btn" onclick="adminBulkCloseCoaching()">Bulk Close Selected</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th><input type="checkbox" id="coachSelectAll" onchange="adminCoachToggleAll(this.checked)"></th>
            <th>Employee Code</th>
            <th>Process</th>
            <th>Title</th>
            <th>Priority</th>
            <th>Assigned To</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">No coaching items</td></tr>` :
              rows.map(row => `
                <tr>
                  <td><input type="checkbox" class="coach-chk" data-id="${row.coaching_id || row.id}"></td>
                  <td>${row.agent_employee_code || '—'}</td>
                  <td>${row.process_name || '—'}</td>
                  <td>${row.coaching_title || row.title || '—'}</td>
                  <td>${sevBadge(row.priority || 'Normal')}</td>
                  <td>${row.assigned_to || '—'}</td>
                  <td>${row.due_date ? new Date(row.due_date).toLocaleDateString() : '—'}</td>
                  <td>${row.closed_at ? '<span class="badge badge-green">Closed</span>' : '<span class="badge badge-yellow">Open</span>'}</td>
                  <td>
                    ${!row.closed_at ? `<button class="btn" style="padding:2px 8px;font-size:12px" onclick="adminCloseCoaching(${row.coaching_id || row.id})">Close</button>` : ''}
                  </td>
                </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div id="createCoachingModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">New Coaching Item</div>
          <div class="form-group"><label class="form-label">Employee Code *</label><input class="filter-input" id="coachEmpCode" placeholder="EMP001"></div>
          <div class="form-group"><label class="form-label">Process Name</label><input class="filter-input" id="coachProcess"></div>
          <div class="form-group"><label class="form-label">Title *</label><input class="filter-input" id="coachTitle"></div>
          <div class="form-group"><label class="form-label">Priority</label>
            <select class="filter-input" id="coachPriority">
              <option value="Normal">Normal</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Assigned To</label><input class="filter-input" id="coachAssigned"></div>
          <div class="form-group"><label class="form-label">Due Date</label><input class="filter-input" type="date" id="coachDue"></div>
          <div class="form-group"><label class="form-label">Notes</label><textarea class="filter-input" id="coachNotes" rows="3" style="width:100%"></textarea></div>
          <div id="coachErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitCoaching()">Create</button>
            <button class="btn" onclick="document.getElementById('createCoachingModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <script>
        function adminShowCreateCoaching() {
          ['coachEmpCode','coachProcess','coachTitle','coachAssigned','coachDue','coachNotes'].forEach(id => document.getElementById(id).value = '');
          document.getElementById('coachPriority').value = 'Normal';
          document.getElementById('coachErr').textContent = '';
          document.getElementById('createCoachingModal').style.display = 'flex';
        }
        async function adminSubmitCoaching() {
          const body = {
            agent_employee_code: document.getElementById('coachEmpCode').value.trim(),
            process_name: document.getElementById('coachProcess').value.trim(),
            coaching_title: document.getElementById('coachTitle').value.trim(),
            priority: document.getElementById('coachPriority').value,
            assigned_to: document.getElementById('coachAssigned').value.trim() || null,
            due_date: document.getElementById('coachDue').value || null,
            notes: document.getElementById('coachNotes').value.trim() || null,
          };
          if (!body.agent_employee_code || !body.coaching_title) { document.getElementById('coachErr').textContent = 'Employee code and title are required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/coaching', body);
          if (r.success) { toast('Coaching item created', 'success'); document.getElementById('createCoachingModal').style.display='none'; go('admin-coaching'); }
          else { document.getElementById('coachErr').textContent = r.message || 'Failed'; }
        }
        async function adminCloseCoaching(id) {
          if (!confirm('Close coaching item #' + id + '?')) return;
          const r = await CALLMASTER_API.put('/api/callmaster/admin/coaching/' + id, { closed_at: new Date().toISOString() });
          r.success ? (toast('Item closed', 'success'), go('admin-coaching')) : toast(r.message || 'Failed', 'error');
        }
        function adminCoachToggleAll(checked) {
          document.querySelectorAll('.coach-chk').forEach(cb => cb.checked = checked);
        }
        async function adminBulkCloseCoaching() {
          const ids = [...document.querySelectorAll('.coach-chk:checked')].map(cb => Number(cb.dataset.id));
          if (!ids.length) { toast('No items selected', 'info'); return; }
          if (!confirm('Close ' + ids.length + ' coaching item(s)?')) return;
          const r = await CALLMASTER_API.post('/api/callmaster/admin/coaching/bulk-close', { ids });
          r.success ? (toast('Items closed', 'success'), go('admin-coaching')) : toast(r.message || 'Failed', 'error');
        }
      <\/script>`;
  },

  // ─────────────────────────────────────────────────────────────
  // 7. Calibration Sessions
  // ─────────────────────────────────────────────────────────────
  'admin-calibration': async function() {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/calibration/sessions');
    const rows = r.data || [];
    return `
      ${pageHeader('Calibration Sessions', 'Create and manage calibration sessions')}
      <div style="margin-bottom:16px">
        <button class="btn btn-primary" onclick="adminShowCreateCalibSession()">+ New Session</button>
      </div>
      ${table(
        [
          { key: 'session_id',   label: 'ID' },
          { key: 'session_name', label: 'Session Name' },
          { key: 'process_name', label: 'Process' },
          { key: 'scheduled_at', label: 'Scheduled', render: v => v ? new Date(v).toLocaleString() : '—' },
          { key: 'status',       label: 'Status', render: v => {
              const cls = v === 'Completed' ? 'badge-green' : v === 'In Progress' ? 'badge-yellow' : 'badge-blue';
              return `<span class="badge ${cls}">${v || 'Pending'}</span>`;
          }},
          { key: 'session_id',   label: 'Actions', render: (id, row) => `
            <button class="btn" style="padding:2px 8px;font-size:12px" onclick="adminViewCalibCalls(${id}, '${(row.session_name||'').replace(/'/g,'&#39;')}')">View Calls</button>
          ` },
        ],
        rows,
        { emptyMsg: 'No calibration sessions found' }
      )}

      <div id="createCalibSessionModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">New Calibration Session</div>
          <div class="form-group"><label class="form-label">Session Name *</label><input class="filter-input" id="csName" placeholder="Q2 Calibration - Inbound"></div>
          <div class="form-group"><label class="form-label">Process Name</label><input class="filter-input" id="csProcess"></div>
          <div class="form-group"><label class="form-label">Scheduled Date/Time</label><input class="filter-input" type="datetime-local" id="csScheduled"></div>
          <div class="form-group"><label class="form-label">Status</label>
            <select class="filter-input" id="csStatus">
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div id="csErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitCalibSession()">Create</button>
            <button class="btn" onclick="document.getElementById('createCalibSessionModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <script>
        function adminShowCreateCalibSession() {
          ['csName','csProcess','csScheduled'].forEach(id => document.getElementById(id).value = '');
          document.getElementById('csStatus').value = 'Pending';
          document.getElementById('csErr').textContent = '';
          document.getElementById('createCalibSessionModal').style.display = 'flex';
        }
        async function adminSubmitCalibSession() {
          const body = {
            session_name: document.getElementById('csName').value.trim(),
            process_name: document.getElementById('csProcess').value.trim() || null,
            scheduled_at: document.getElementById('csScheduled').value || null,
            status: document.getElementById('csStatus').value,
          };
          if (!body.session_name) { document.getElementById('csErr').textContent = 'Session name is required'; return; }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/calibration/sessions', body);
          if (r.success) { toast('Session created', 'success'); document.getElementById('createCalibSessionModal').style.display='none'; go('admin-calibration'); }
          else { document.getElementById('csErr').textContent = r.message || 'Failed'; }
        }
        function adminViewCalibCalls(sessionId, sessionName) {
          window._calibSessionId = sessionId;
          window._calibSessionName = sessionName;
          go('admin-calibration-calls');
        }
      <\/script>`;
  },

  // ─────────────────────────────────────────────────────────────
  // 8. Calibration Call Detail
  // ─────────────────────────────────────────────────────────────
  'admin-calibration-calls': async function() {
    const sessionId = window._calibSessionId;
    if (!sessionId) {
      return `${pageHeader('Calibration Call Detail', 'No session selected')}
        <div style="margin-bottom:12px"><button class="btn" onclick="go('admin-calibration')">← Back to Sessions</button></div>
        ${emptyState('Please select a calibration session first.')}`;
    }
    const r = await CALLMASTER_API.get('/api/callmaster/admin/calibration/calls?session_id=' + sessionId);
    const rows = r.data || [];
    const sessionName = window._calibSessionName || ('Session #' + sessionId);
    return `
      ${pageHeader('Calibration Calls — ' + sessionName, 'Session ID: ' + sessionId)}
      <div style="margin-bottom:12px;display:flex;gap:8px">
        <button class="btn" onclick="go('admin-calibration')">← Back to Sessions</button>
        <button class="btn btn-primary" onclick="adminShowAddCalibCall()">+ Add Call</button>
      </div>
      ${table(
        [
          { key: 'call_id',                    label: 'Call ID' },
          { key: 'source_call_id',             label: 'Source Call ID' },
          { key: 'agent_employee_code',        label: 'Employee Code' },
          { key: 'manual_quality_percentage',  label: 'Manual QC%', render: v => v != null ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'ai_quality_percentage',      label: 'AI QC%',     render: v => v != null ? `<span class="td-mono">${v}%</span>` : '—' },
          { key: 'call_notes',                 label: 'Notes', render: v => v ? `<span title="${v}">${v.substring(0,60)}${v.length>60?'…':''}</span>` : '—' },
        ],
        rows,
        { emptyMsg: 'No calls in this session yet' }
      )}

      <div id="addCalibCallModal" class="modal-overlay" style="display:none">
        <div class="modal-box">
          <div class="modal-title">Add Calibration Call</div>
          <div class="form-group"><label class="form-label">Source Call ID *</label><input class="filter-input" id="ccSourceCallId" placeholder="CALL_12345"></div>
          <div class="form-group"><label class="form-label">Agent Employee Code *</label><input class="filter-input" id="ccEmpCode" placeholder="EMP001"></div>
          <div class="form-group"><label class="form-label">Manual Quality % *</label><input class="filter-input" type="number" id="ccManualQc" placeholder="85" min="0" max="100"></div>
          <div class="form-group"><label class="form-label">AI Quality % (optional)</label><input class="filter-input" type="number" id="ccAiQc" placeholder="82" min="0" max="100"></div>
          <div class="form-group"><label class="form-label">Call Notes</label><textarea class="filter-input" id="ccNotes" rows="3" style="width:100%"></textarea></div>
          <div id="ccErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitCalibCall()">Add Call</button>
            <button class="btn" onclick="document.getElementById('addCalibCallModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <script>
        function adminShowAddCalibCall() {
          ['ccSourceCallId','ccEmpCode','ccManualQc','ccAiQc','ccNotes'].forEach(id => document.getElementById(id).value = '');
          document.getElementById('ccErr').textContent = '';
          document.getElementById('addCalibCallModal').style.display = 'flex';
        }
        async function adminSubmitCalibCall() {
          const aiQc = document.getElementById('ccAiQc').value;
          const body = {
            session_id: ${sessionId},
            source_call_id: document.getElementById('ccSourceCallId').value.trim(),
            agent_employee_code: document.getElementById('ccEmpCode').value.trim(),
            manual_quality_percentage: Number(document.getElementById('ccManualQc').value),
            ai_quality_percentage: aiQc ? Number(aiQc) : null,
            call_notes: document.getElementById('ccNotes').value.trim() || null,
          };
          if (!body.source_call_id || !body.agent_employee_code || isNaN(body.manual_quality_percentage)) {
            document.getElementById('ccErr').textContent = 'Source call ID, employee code and manual QC% are required'; return;
          }
          const r = await CALLMASTER_API.post('/api/callmaster/admin/calibration/calls', body);
          if (r.success) { toast('Call added', 'success'); document.getElementById('addCalibCallModal').style.display='none'; go('admin-calibration-calls'); }
          else { document.getElementById('ccErr').textContent = r.message || 'Failed'; }
        }
      <\/script>`;
  },

  // ─────────────────────────────────────────────────────────────
  // 9. Audit Prompt Config
  // ─────────────────────────────────────────────────────────────
  'admin-audit-config': async function() {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/audit-prompts');
    const rows = r.data || [];
    return `
      ${pageHeader('Audit Prompt Config', 'Configure AI audit prompts per process/parameter')}
      <div style="margin-bottom:16px">
        <button class="btn btn-primary" onclick="adminShowCreatePrompt()">+ New Prompt</button>
      </div>
      ${table(
        [
          { key: 'prompt_id',    label: 'ID' },
          { key: 'process_name', label: 'Process' },
          { key: 'parameter',    label: 'Parameter' },
          { key: 'source_type',  label: 'Type', render: v => v ? `<span class="badge badge-${v==='Inbound'?'blue':'violet'}">${v}</span>` : '—' },
          { key: 'prompt_text',  label: 'Prompt', render: v => v ? `<span title="${v}">${v.substring(0,80)}${v.length>80?'…':''}</span>` : '—' },
          { key: 'is_active',    label: 'Status', render: v => v || v === 1 ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>' },
          { key: 'prompt_id',    label: 'Actions', render: (id, row) => `
            <button class="btn" style="padding:2px 8px;font-size:12px" onclick='adminEditPrompt(${JSON.stringify(row).split("'").join("&#39;")})'>Edit</button>
            <button class="btn" style="padding:2px 8px;font-size:12px;margin-left:4px;color:var(--danger)" onclick="adminDeletePrompt(${id})">Delete</button>
          ` },
        ],
        rows,
        { emptyMsg: 'No audit prompts configured' }
      )}

      <div id="createPromptModal" class="modal-overlay" style="display:none">
        <div class="modal-box" style="max-width:600px">
          <div class="modal-title" id="promptModalTitle">Add Audit Prompt</div>
          <input type="hidden" id="promptEditId">
          <div class="form-group"><label class="form-label">Process Name *</label><input class="filter-input" id="promptProcess" placeholder="GNC Inbound"></div>
          <div class="form-group"><label class="form-label">Parameter *</label><input class="filter-input" id="promptParam" placeholder="Professionalism"></div>
          <div class="form-group"><label class="form-label">Source Type</label>
            <select class="filter-input" id="promptSourceType">
              <option value="">-- Select --</option>
              <option value="Inbound">Inbound</option>
              <option value="Outbound">Outbound</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Prompt Text *</label>
            <textarea class="filter-input" id="promptText" rows="6" style="width:100%;font-family:monospace;font-size:12px" placeholder="Evaluate the agent's professionalism in this call..."></textarea>
          </div>
          <div class="form-group"><label class="form-label">Active</label>
            <select class="filter-input" id="promptActive">
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
          <div id="promptErr" style="color:var(--danger);font-size:13px"></div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" onclick="adminSubmitPrompt()">Save</button>
            <button class="btn" onclick="document.getElementById('createPromptModal').style.display='none'">Cancel</button>
          </div>
        </div>
      </div>

      <script>
        function adminShowCreatePrompt() {
          document.getElementById('promptModalTitle').textContent = 'Add Audit Prompt';
          document.getElementById('promptEditId').value = '';
          ['promptProcess','promptParam','promptText'].forEach(id => document.getElementById(id).value = '');
          document.getElementById('promptSourceType').value = '';
          document.getElementById('promptActive').value = '1';
          document.getElementById('promptErr').textContent = '';
          document.getElementById('createPromptModal').style.display = 'flex';
        }
        function adminEditPrompt(row) {
          document.getElementById('promptModalTitle').textContent = 'Edit Audit Prompt';
          document.getElementById('promptEditId').value = row.prompt_id || '';
          document.getElementById('promptProcess').value = row.process_name || '';
          document.getElementById('promptParam').value = row.parameter || '';
          document.getElementById('promptSourceType').value = row.source_type || '';
          document.getElementById('promptText').value = row.prompt_text || '';
          document.getElementById('promptActive').value = (row.is_active || row.is_active === 1) ? '1' : '0';
          document.getElementById('promptErr').textContent = '';
          document.getElementById('createPromptModal').style.display = 'flex';
        }
        async function adminSubmitPrompt() {
          const id = document.getElementById('promptEditId').value;
          const body = {
            process_name: document.getElementById('promptProcess').value.trim(),
            parameter: document.getElementById('promptParam').value.trim(),
            source_type: document.getElementById('promptSourceType').value || null,
            prompt_text: document.getElementById('promptText').value.trim(),
            is_active: document.getElementById('promptActive').value === '1',
          };
          if (!body.process_name || !body.parameter || !body.prompt_text) { document.getElementById('promptErr').textContent = 'Process, parameter and prompt text are required'; return; }
          const r = id
            ? await CALLMASTER_API.put('/api/callmaster/admin/audit-prompts/' + id, body)
            : await CALLMASTER_API.post('/api/callmaster/admin/audit-prompts', body);
          if (r.success) { toast(id ? 'Prompt updated' : 'Prompt created', 'success'); document.getElementById('createPromptModal').style.display='none'; go('admin-audit-config'); }
          else { document.getElementById('promptErr').textContent = r.message || 'Failed'; }
        }
        async function adminDeletePrompt(id) {
          if (!confirm('Delete prompt #' + id + '?')) return;
          const r = await CALLMASTER_API.delete('/api/callmaster/admin/audit-prompts/' + id);
          r.success ? (toast('Prompt deleted', 'success'), go('admin-audit-config')) : toast(r.message || 'Failed', 'error');
        }
      <\/script>`;
  },

  // ─────────────────────────────────────────────────────────────
  // 10. Data Source Mapping (static info page)
  // ─────────────────────────────────────────────────────────────
  'admin-data-sources': function() {
    return `
      ${pageHeader('Data Source Mapping', 'How Call Master reads from source databases')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div class="card">
          <div class="chart-title">Inbound Source (shivamgiri)</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Primary inbound call quality database</div>
          <table style="width:100%;font-size:13px">
            <thead><tr><th style="text-align:left;padding:6px 4px;border-bottom:1px solid var(--border)">Table</th><th style="text-align:left;padding:6px 4px;border-bottom:1px solid var(--border)">Description</th></tr></thead>
            <tbody>
              <tr><td style="padding:6px 4px;font-family:monospace">inbound_calls</td><td style="padding:6px 4px">Raw inbound call records</td></tr>
              <tr><td style="padding:6px 4px;font-family:monospace">inbound_quality_scores</td><td style="padding:6px 4px">Per-call quality scores</td></tr>
              <tr><td style="padding:6px 4px;font-family:monospace">inbound_parameters</td><td style="padding:6px 4px">Parameter definitions</td></tr>
              <tr><td style="padding:6px 4px;font-family:monospace">inbound_defects</td><td style="padding:6px 4px">Defect records per call</td></tr>
              <tr><td style="padding:6px 4px;font-family:monospace">inbound_fatal_checks</td><td style="padding:6px 4px">Fatal parameter outcomes</td></tr>
              <tr><td style="padding:6px 4px;font-family:monospace">inbound_escalations</td><td style="padding:6px 4px">Escalation records</td></tr>
            </tbody>
          </table>
        </div>
        <div class="card">
          <div class="chart-title">Outbound Source (db_external)</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">External outbound campaign database</div>
          <table style="width:100%;font-size:13px">
            <thead><tr><th style="text-align:left;padding:6px 4px;border-bottom:1px solid var(--border)">Table</th><th style="text-align:left;padding:6px 4px;border-bottom:1px solid var(--border)">Description</th></tr></thead>
            <tbody>
              <tr><td style="padding:6px 4px;font-family:monospace">outbound_calls</td><td style="padding:6px 4px">Raw outbound call records</td></tr>
              <tr><td style="padding:6px 4px;font-family:monospace">outbound_quality_scores</td><td style="padding:6px 4px">Per-call quality scores</td></tr>
              <tr><td style="padding:6px 4px;font-family:monospace">outbound_parameters</td><td style="padding:6px 4px">Parameter definitions</td></tr>
              <tr><td style="padding:6px 4px;font-family:monospace">outbound_defects</td><td style="padding:6px 4px">Defect records per call</td></tr>
              <tr><td style="padding:6px 4px;font-family:monospace">outbound_cst_crt</td><td style="padding:6px 4px">CST/CRT funnel data</td></tr>
              <tr><td style="padding:6px 4px;font-family:monospace">outbound_nps_csat</td><td style="padding:6px 4px">NPS and CSAT records</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="chart-title">Unified Call Master Schema (Read-Write)</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Internal tables managed by Call Master</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          ${[
            ['cm_users', 'System users and auth'],
            ['cm_employees', 'Employee master records'],
            ['cm_agent_aliases', 'Agent alias mappings'],
            ['cm_processes', 'Process configuration'],
            ['dashboard_exclusion_rules', 'Client exclusion rules'],
            ['call_coaching_queue', 'Coaching queue items'],
            ['calibration_sessions', 'Calibration sessions'],
            ['calibration_calls', 'Calibration call results'],
            ['audit_prompts', 'AI audit prompt configs'],
          ].map(([tbl, desc]) => `
            <div style="background:var(--bg-hover);border-radius:6px;padding:10px 12px">
              <div style="font-family:monospace;font-size:12px;color:var(--accent);margin-bottom:4px">${tbl}</div>
              <div style="font-size:12px;color:var(--text-muted)">${desc}</div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  // ─────────────────────────────────────────────────────────────
  // 11. Role Impersonation
  // ─────────────────────────────────────────────────────────────
  'admin-impersonate': async function() {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/users');
    const users = (r.data || []).filter(u => u.is_active || u.is_active === 1);
    return `
      ${pageHeader('Role Impersonation', 'Switch to another user\'s session for testing')}
      <div class="card" style="max-width:480px">
        <div class="chart-title" style="margin-bottom:16px">Switch Active Session</div>
        <div style="background:var(--bg-hover);border-radius:6px;padding:12px 14px;margin-bottom:20px;font-size:13px;color:var(--text-muted)">
          <strong style="color:var(--text)">Warning:</strong> Impersonating a user replaces your current session token. You will need to log in again to return to your admin session.
        </div>
        <div class="form-group">
          <label class="form-label">Select User to Impersonate</label>
          <select class="filter-input" id="impersonateUserId" style="width:100%">
            <option value="">-- Select a user --</option>
            ${users.map(u => `<option value="${u.user_id}">${u.full_name} (${u.username}) — ${u.role}</option>`).join('')}
          </select>
        </div>
        <div id="impersonateErr" style="color:var(--danger);font-size:13px;margin-bottom:12px"></div>
        <button class="btn btn-primary" onclick="adminSubmitImpersonate()">Switch View</button>
      </div>

      <script>
        async function adminSubmitImpersonate() {
          const userId = document.getElementById('impersonateUserId').value;
          if (!userId) { document.getElementById('impersonateErr').textContent = 'Please select a user'; return; }
          if (!confirm('Switch to user #' + userId + '? You will need to log in again to return to admin.')) return;
          const r = await CALLMASTER_API.post('/api/callmaster/admin/impersonate', { target_user_id: Number(userId) });
          if (r.success && r.data && r.data.token) {
            toast('Switching session...', 'info');
            onLogin(r.data.token, r.data.user);
          } else {
            document.getElementById('impersonateErr').textContent = r.message || 'Impersonation failed';
          }
        }
      <\/script>`;
  },

  // ─────────────────────────────────────────────────────────────
  // 12. System Health
  // ─────────────────────────────────────────────────────────────
  'admin-health': async function() {
    const r = await CALLMASTER_API.get('/api/callmaster/admin/system-health');
    const d = r.data || {};
    const pools = d.pools || {};
    const inbound = pools.shivamgiri || {};
    const outbound = pools.db_external || {};
    const checkedAt = d.checked_at ? new Date(d.checked_at).toLocaleString() : '—';

    const poolStatusKpi = (label, pool) => {
      const isUp = pool.status === 'up' || pool.status === 'connected';
      const latency = pool.latency_ms != null ? pool.latency_ms + 'ms' : '';
      return kpi(label, isUp ? 'UP' : 'DOWN', latency, isUp ? 'up' : 'down');
    };

    return `
      ${pageHeader('System Health', 'Database pool status and counters · checked at ' + checkedAt)}
      <div style="margin-bottom:8px;display:flex;justify-content:flex-end">
        <button class="btn" onclick="go('admin-health')">Refresh</button>
      </div>
      <div style="margin-bottom:12px">
        <div class="page-sub" style="font-size:13px;color:var(--text-muted)">Database Pools</div>
      </div>
      <div class="kpi-grid" style="margin-bottom:24px">
        ${poolStatusKpi('Inbound DB (shivamgiri)', inbound)}
        ${poolStatusKpi('Outbound DB (db_external)', outbound)}
      </div>
      <div style="margin-bottom:12px">
        <div class="page-sub" style="font-size:13px;color:var(--text-muted)">Application Counters</div>
      </div>
      <div class="kpi-grid">
        ${kpi('CM Users', pools.cm_users_count != null ? pools.cm_users_count : '—')}
        ${kpi('Active Processes', pools.active_processes != null ? pools.active_processes : '—')}
        ${kpi('Open Coaching Items', pools.open_coaching_items != null ? pools.open_coaching_items : '—', '', pools.open_coaching_items > 0 ? 'down' : 'up')}
      </div>
      ${!r.success ? `<div style="margin-top:16px;color:var(--danger);font-size:13px">Failed to load health data: ${r.message || 'Unknown error'}</div>` : ''}`;
  },

};
