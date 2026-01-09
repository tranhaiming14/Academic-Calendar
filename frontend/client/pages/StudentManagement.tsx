import React, { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const StudentManagement: React.FC = () => {
  const API_BASE = (import.meta.env && (import.meta.env.VITE_API_BASE as string)) || "";
  const [students, setStudents] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [majors, setMajors] = useState<any[]>([]);
  const [filterYear, setFilterYear] = useState<number | null>(null);
  const [filterMajor, setFilterMajor] = useState<number | null>(null);
  const [query, setQuery] = useState<string>("");
  const searchTimer = React.useRef<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const fetchPage = async (p: number, opts?: { year?: number | null; major?: number | null; q?: string | null }) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      // build query params with filters; use opts overrides when provided to avoid stale state
      const params = new URLSearchParams();
      params.set('page', String(p));
      const yearVal = opts && Object.prototype.hasOwnProperty.call(opts, 'year') ? opts!.year : filterYear;
      const majorVal = opts && Object.prototype.hasOwnProperty.call(opts, 'major') ? opts!.major : filterMajor;
      const qVal = opts && Object.prototype.hasOwnProperty.call(opts, 'q') ? opts!.q : query;
      if (yearVal) params.set('year', String(yearVal));
      if (majorVal) params.set('major', String(majorVal));
      if (qVal) params.set('q', String(qVal));
      const res = await fetch(`${API_BASE}/api/users/students/?${params.toString()}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setStudents(data.results || []);
        setCount(data.count || 0);
        setPage(p);
      } else {
        console.error("Failed to fetch students", data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(1);
    // fetch majors for filter
    (async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const headers: any = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const r = await fetch(`${API_BASE}/api/users/majors/`, { headers });
        const d = await r.json();
        if (r.ok) setMajors(d || []);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  // trigger search with debounce
  const onQueryChange = (v: string) => {
    setQuery(v);
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    // debounce 350ms
    searchTimer.current = window.setTimeout(() => {
      fetchPage(1, { year: filterYear, major: filterMajor, q: v || null });
    }, 350) as unknown as number;
  };

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const toggleSelectAll = () => {
    const visibleIds = students.map((s) => s.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(selectedIds.filter((id) => !visibleIds.includes(id)));
    } else {
      // add visible ids that are not already selected
      const next = Array.from(new Set([...selectedIds, ...visibleIds]));
      setSelectedIds(next);
    }
  };

  const toggleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((x) => x !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const promoteSelected = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`Promote ${selectedIds.length} selected students by one year?`)) return;
    try {
      const token = localStorage.getItem("accessToken");
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/api/users/students/bulk-promote/`, { method: 'POST', headers, body: JSON.stringify({ student_ids: selectedIds }) });
      const data = await res.json();
      if (res.ok) {
        toast({ title: `Promoted ${data.updated || 0} students`, description: `${(data.promoted_ids || []).length} promoted, ${(data.skipped || []).length} skipped` });
        setSelectedIds([]);
        fetchPage(page);
      } else {
        toast({ title: 'Promotion failed', description: JSON.stringify(data) });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Promotion error', description: String(err) });
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
      <Sidebar />
      <main className="w-full self-start flex flex-col h-full min-h-0">
        <div className="flex gap-6 flex-1 min-h-0 p-6">
          <div className="w-full bg-white p-6 rounded-b-2xl shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Student Management</h2>
              <div className="text-sm text-gray-500">Showing {pageSize} per page</div>
            </div>

            <div className="flex gap-3 items-center mb-4">
              <div>
                <label className="text-sm">Search</label>
                <input
                  placeholder="Search by name or student ID"
                  className="ml-2 rounded-md border border-gray-200 px-2 py-1"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm">Year</label>
                <select className="ml-2 rounded-md border border-gray-200 px-2 py-1" value={filterYear ?? ''} onChange={(e) => { const val = e.target.value ? Number(e.target.value) : null; setFilterYear(val); fetchPage(1, { year: val }); }}>
                  <option value="">All</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </div>
              <div>
                <label className="text-sm">Major</label>
                <select className="ml-2 rounded-md border border-gray-200 px-2 py-1" value={filterMajor ?? ''} onChange={(e) => { const val = e.target.value ? Number(e.target.value) : null; setFilterMajor(val); fetchPage(1, { major: val }); }}>
                  <option value="">All</option>
                  {majors.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => { setFilterMajor(null); setFilterYear(null); fetchPage(1, { major: null, year: null }); }}>Reset</Button>
            </div>

            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <input type="checkbox" checked={students.length > 0 && students.every(s => selectedIds.includes(s.id))} onChange={toggleSelectAll} />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Major</TableHead>
                    <TableHead>Year</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelectOne(s.id)} />
                      </TableCell>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>{s.student_id}</TableCell>
                      <TableCell>{s.major ? s.major.name || s.major : <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>
                        {s.year} {s.can_advance === false && <span className="ml-2 text-xs text-red-600">(cannot advance)</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">{count} students — page {page} of {totalPages}</div>
              <div className="flex items-center gap-2">
                <Button variant="default" disabled={!selectedIds.length} onClick={promoteSelected}>Promote selected</Button>
                <Button variant="outline" disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1)}>Previous</Button>
                <Button variant="outline" disabled={page >= totalPages || loading} onClick={() => fetchPage(page + 1)}>Next</Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default StudentManagement;
