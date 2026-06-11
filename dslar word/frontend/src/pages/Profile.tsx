import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Phone, Mail, Camera, Save } from 'lucide-react';
import { userApi } from '../api/user.api';
import { useAuthStore } from '../store/authStore';
import { QUERY_KEYS } from '../constants/queryKeys';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PageSpinner } from '../components/ui/Spinner';
import toast from 'react-hot-toast';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Enter a valid 10-digit number'),
});
type ProfileForm = z.infer<typeof profileSchema>;

const Profile: React.FC = () => {
  const { updateUser } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.ME],
    queryFn: () => userApi.getMe().then((r) => r.data.data),
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { name: data?.name || '', phone: data?.phone || '' },
  });

  const mutation = useMutation({
    mutationFn: (formData: ProfileForm) => userApi.updateMe(formData),
    onSuccess: (res) => {
      updateUser(res.data.data!);
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.ME] });
      toast.success('Profile updated!');
    },
    onError: () => toast.error('Failed to update profile'),
  });

  if (isLoading) return <PageSpinner />;

  return (
    <>
      <Helmet><title>My Profile | DSLR WORLD</title></Helmet>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="font-poppins font-bold text-2xl text-midnight mb-6">My Profile</h1>

        <div className="bg-white rounded-2xl shadow-card p-6">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-accent rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-accent">
                {data?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-midnight rounded-full flex items-center justify-center cursor-pointer hover:bg-accent transition-colors">
                <Camera size={12} className="text-white" />
              </div>
            </div>
            <div>
              <h2 className="font-poppins font-bold text-xl text-midnight">{data?.name}</h2>
              <div className="flex items-center gap-1 text-gray-500 text-sm mt-0.5">
                <Mail size={13} />
                <span>{data?.email}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block ${
                data?.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {data?.role}
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
            <Input
              label="Full Name"
              leftIcon={<User size={16} />}
              error={errors.name?.message}
              required
              {...register('name')}
            />
            <Input
              label="Mobile Number"
              type="tel"
              leftIcon={<Phone size={16} />}
              error={errors.phone?.message}
              required
              {...register('phone')}
            />
            <div>
              <label className="text-sm font-medium text-gray-700 font-poppins block mb-1.5">
                Email Address
              </label>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50">
                <Mail size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500">{data?.email}</span>
                <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Cannot change</span>
              </div>
            </div>
            <Button type="submit" loading={isSubmitting || mutation.isPending} leftIcon={<Save size={15} />}>
              Save Changes
            </Button>
          </form>
        </div>
      </div>
    </>
  );
};

export default Profile;
