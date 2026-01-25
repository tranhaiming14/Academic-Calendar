import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const StaffManagement: React.FC = () => {
  const API_BASE = (import.meta.env && (import.meta.env.VITE_API_BASE as string)) || "";
  const [staff, setStaff] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // add form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("tutor");
  const [staffId, setStaffId] = useState("");

  const fetchList = async (q?: string, role?: string | null) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (role) params.set('role', role);
      const res = await fetch(`${API_BASE}/api/users/staff/?${params.toString()}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setStaff(data.results || data || []);
      } else {
        console.error(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const onSearch = (v: string) => {
    setQuery(v);
    fetchList(v || undefined, roleFilter);
  };

  const onRoleChange = (r: string | null) => {
    setRoleFilter(r);
    fetchList(query || undefined, r);
  };

  const addStaff = async () => {
    if (!name || !email) {
      toast({ title: 'Name and email required' });
      return;
    }
    try {
      const token = localStorage.getItem("accessToken");
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const body = { name, email, role, staff_id: staffId };
      const res = await fetch(`${API_BASE}/api/users/create-staff/`, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Staff created' });
        setName(''); setEmail(''); setStaffId(''); setRole('tutor');
        fetchList(query || undefined);
      } else {
        toast({ title: 'Create failed', description: JSON.stringify(data) });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Create error', description: String(err) });
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
      <Sidebar />
      <main className="w-full self-start flex flex-col h-full min-h-0">
        <div className="flex gap-6 flex-1 min-h-0 p-6">
          <div className="w-full bg-white p-6 rounded-b-2xl shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Staff Management</h2>
              <div className="text-sm text-gray-500">Manage tutors and assistants</div>
            </div>

            <div className="flex gap-3 items-center mb-4">
              <div>
                <label className="text-sm">Search</label>
                <input placeholder="Search by name or email" className="ml-2 rounded-md border border-gray-200 px-2 py-1" value={query} onChange={(e) => onSearch(e.target.value)} />
              </div>
              <div>
                <label className="text-sm">Role</label>
                <select className="ml-2 rounded-md border border-gray-200 px-2 py-1" value={roleFilter ?? ''} onChange={(e) => onRoleChange(e.target.value || null)}>
                  <option value="">All</option>
                  <option value="tutor">Tutor</option>
                  <option value="academic_assistant">Academic Assistant</option>
                  <option value="department_assistant">Department Assistant</option>
                </select>
              </div>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => { setQuery(''); setRoleFilter(null); fetchList(); }}>Reset</Button>
            </div>

            <div className="mb-4 border rounded p-3">
              <div className="flex gap-3 items-end">
                <div>
                  <label className="text-sm">Name</label>
                  <input className="ml-2 rounded-md border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm">Email</label>
                  <input className="ml-2 rounded-md border px-2 py-1" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm">Role</label>
                  <select className="ml-2 rounded-md border px-2 py-1" value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="tutor">Tutor</option>
                    <option value="academic_assistant">Academic Assistant</option>
                    <option value="department_assistant">Department Assistant</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm">ID</label>
                  <input className="ml-2 rounded-md border px-2 py-1" value={staffId} onChange={(e) => setStaffId(e.target.value)} />
                </div>
                <div className="ml-auto">
                  <Button onClick={addStaff}>Add Staff</Button>
                </div>
              </div>
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>{s.staff_id || '-'}</TableCell>
                      <TableCell>{s.role}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StaffManagement;
