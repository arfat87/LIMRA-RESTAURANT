import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Shield, ShieldOff, Users, Crown } from 'lucide-react';
import { adminUserApi } from '../../api/admin.api';
import { Pagination } from '../../components/ui/Pagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { formatDateOnly } from '../../utils/formatDate';
import toast from 'react-hot-toast';

interface UserItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
  _count?: { orders: number };
}

const AdminUsers: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => adminUserApi.getAll({ page, limit: 15, search: search || undefined }).then((r) => r.data.data),
  });

  const users: UserItem[] = (data as { users?: UserItem[] })?.users || [];
  const pagination = (data as { pagination?: { page: number; totalPages: number; hasNext: boolean; hasPrev: boolean } })?.pagination;

  const banMutation = useMutation({
    mutationFn: (id: string) => adminUserApi.ban(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User banned'); },
    onError: () => toast.error('Failed to ban user'),
  });

  const unbanMutation = useMutation({
    mutationFn: (id: string) => adminUserApi.unban(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User unbanned'); },
    onError: () => toast.error('Failed to unban user'),
  });

  const makeAdminMutation = useMutation({
    mutationFn: (id: string) => adminUserApi.makeAdmin(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User promoted to Admin'); },
    onError: () => toast.error('Failed to update role'),
  });

  return (
    <>
      <Helmet><title>Users | Admin | DSLR WORLD</title></Helmet>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-poppins font-bold text-2xl text-midnight">Users</h1>
            <p className="text-sm text-gray-500 mt-0.5">All registered customers and admins</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <Users size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600 font-medium">{users.length} shown</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['User', 'Contact', 'Role', 'Orders', 'Joined', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 font-poppins text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-4 py-4">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                      <Users size={36} className="mx-auto mb-3 text-gray-300" />
                      <p>No users found</p>
                    </td>
                  </tr>
                ) : users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    {/* Name + ID */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-accent to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{user.name}</p>
                          <p className="text-xs text-gray-400 font-mono">{user.id.slice(-8)}</p>
                        </div>
                      </div>
                    </td>
                    {/* Contact */}
                    <td className="px-4 py-3">
                      <p className="text-gray-700">{user.email}</p>
                      <p className="text-xs text-gray-400">{user.phone}</p>
                    </td>
                    {/* Role */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                        user.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {user.role === 'ADMIN' && <Crown size={10} />}
                        {user.role}
                      </span>
                    </td>
                    {/* Orders */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-700">{user._count?.orders ?? 0}</span>
                    </td>
                    {/* Joined */}
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {formatDateOnly(user.createdAt)}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.isActive ? 'Active' : 'Banned'}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {user.isActive ? (
                          <button
                            onClick={() => { if (confirm(`Ban ${user.name}?`)) banMutation.mutate(user.id); }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Ban user"
                          >
                            <ShieldOff size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => unbanMutation.mutate(user.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Unban user"
                          >
                            <Shield size={14} />
                          </button>
                        )}
                        {user.role !== 'ADMIN' && (
                          <button
                            onClick={() => { if (confirm(`Make ${user.name} an Admin?`)) makeAdminMutation.mutate(user.id); }}
                            className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors" title="Make Admin"
                          >
                            <Crown size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {pagination && (
          <Pagination
            page={page}
            totalPages={pagination.totalPages}
            hasNext={pagination.hasNext}
            hasPrev={pagination.hasPrev}
            onPageChange={setPage}
          />
        )}
      </div>
    </>
  );
};

export default AdminUsers;
