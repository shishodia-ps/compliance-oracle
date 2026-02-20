'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  User,
  Bell,
  Shield,
  Palette,
  Building2,
  Loader2,
  Check,
  Camera,
  Trash2,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

interface UserSettings {
  name: string;
  email: string;
  avatar: string | null;
  notifications: {
    email: boolean;
    push: boolean;
    tasks: boolean;
    documents: boolean;
    invoices: boolean;
  };
  preferences: {
    theme: string;
    language: string;
    timezone: string;
  };
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website: string | null;
  logo: string | null;
  _count?: {
    members: number;
    documents: number;
    matters: number;
  };
}

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    name: '',
    email: '',
    avatar: null,
    notifications: {
      email: true,
      push: true,
      tasks: true,
      documents: true,
      invoices: true,
    },
    preferences: {
      theme: 'system',
      language: 'en',
      timezone: 'UTC',
    },
  });
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  // Organization state
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgForm, setOrgForm] = useState({ name: '', description: '', website: '' });
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  
  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetchSettings();
      fetchOrganization();
    }
  }, [session]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      setSettings({
        name: data.name || session?.user?.name || '',
        email: data.email || session?.user?.email || '',
        avatar: data.avatar || session?.user?.image || null,
        notifications: { ...settings.notifications, ...data.notifications },
        preferences: { ...settings.preferences, ...data.preferences },
      });
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrganization = async () => {
    try {
      const response = await fetch('/api/organization');
      if (!response.ok) return;
      const data = await response.json();
      setOrganization(data.organization);
      setOrgForm({
        name: data.organization.name || '',
        description: data.organization.description || '',
        website: data.organization.website || '',
      });
      setIsOrgAdmin(['ADMIN', 'MANAGER'].includes(data.membership?.role));
    } catch (error) {
      console.error('Failed to load organization');
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.name,
          notifications: settings.notifications,
          preferences: settings.preferences,
        }),
      });

      if (!response.ok) throw new Error('Failed to save settings');
      await update({ name: settings.name });
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save notifications when toggled
  const handleNotificationChange = useCallback(async (key: keyof typeof settings.notifications) => {
    const newNotifications = {
      ...settings.notifications,
      [key]: !settings.notifications[key],
    };
    
    setSettings((prev) => ({ ...prev, notifications: newNotifications }));
    
    // Auto-save
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: newNotifications }),
      });
    } catch (error) {
      toast.error('Failed to save notification preference');
    }
  }, [settings.notifications]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingAvatar(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload avatar');

      const data = await response.json();
      setSettings((prev) => ({ ...prev, avatar: data.imageUrl }));
      await update({ image: data.imageUrl });
      toast.success('Avatar updated successfully');
    } catch (error) {
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    try {
      const response = await fetch('/api/user/avatar', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to remove avatar');

      setSettings((prev) => ({ ...prev, avatar: null }));
      await update({ image: null });
      toast.success('Avatar removed');
    } catch (error) {
      toast.error('Failed to remove avatar');
    }
  };

  const handleSaveOrganization = async () => {
    try {
      setIsSavingOrg(true);
      const response = await fetch('/api/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgForm),
      });

      if (!response.ok) throw new Error('Failed to save organization');
      
      const data = await response.json();
      setOrganization(data.organization);
      toast.success('Organization details saved');
    } catch (error) {
      toast.error('Failed to save organization');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setIsChangingPassword(true);
      const response = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account, organization, and preferences</p>
      </motion.div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile" className="gap-2"><User className="w-4 h-4" />Profile</TabsTrigger>
          <TabsTrigger value="organization" className="gap-2"><Building2 className="w-4 h-4" />Organization</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" />Notifications</TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2"><Palette className="w-4 h-4" />Preferences</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="w-4 h-4" />Security</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information and avatar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  {settings.avatar ? (
                    <img src={settings.avatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-2 border-amber-500/30" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center border-2 border-amber-500/30">
                      <span className="text-2xl font-bold text-amber-500">{getInitials(settings.name || 'U')}</span>
                    </div>
                  )}
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Profile Picture</Label>
                  <p className="text-sm text-muted-foreground">Upload a photo to personalize your account</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={isUploadingAvatar} onClick={() => document.getElementById('avatar-upload')?.click()}>
                      <Camera className="w-4 h-4 mr-2" />
                      {settings.avatar ? 'Change Avatar' : 'Upload Avatar'}
                    </Button>
                    {settings.avatar && (
                      <Button variant="outline" size="sm" onClick={handleAvatarRemove} disabled={isUploadingAvatar}>
                        <Trash2 className="w-4 h-4 mr-2" />Remove
                      </Button>
                    )}
                    <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarUpload} />
                  </div>
                  <p className="text-xs text-muted-foreground">Max size: 2MB. Supported: JPG, PNG, GIF, WebP</p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={settings.email} disabled className="bg-muted" />
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button className="bg-amber-500 hover:bg-amber-600" onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Check className="w-4 h-4 mr-2" />Save Changes</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Tab */}
        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Manage your organization information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {organization ? (
                <>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input 
                        id="org-name" 
                        value={orgForm.name} 
                        onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                        disabled={!isOrgAdmin}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-description">Description</Label>
                      <Input 
                        id="org-description" 
                        value={orgForm.description} 
                        onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                        disabled={!isOrgAdmin}
                        placeholder="Brief description of your organization"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-website">Website</Label>
                      <Input 
                        id="org-website" 
                        type="url"
                        value={orgForm.website} 
                        onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })}
                        disabled={!isOrgAdmin}
                        placeholder="https://example.com"
                      />
                    </div>
                  </div>
                  
                  {organization._count && (
                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{organization._count.members}</p>
                        <p className="text-sm text-muted-foreground">Members</p>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{organization._count.documents}</p>
                        <p className="text-sm text-muted-foreground">Documents</p>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <p className="text-2xl font-bold">{organization._count.matters}</p>
                        <p className="text-sm text-muted-foreground">Matters</p>
                      </div>
                    </div>
                  )}
                  
                  <Separator />
                  <div className="flex justify-between items-center">
                    {!isOrgAdmin && (
                      <p className="text-sm text-muted-foreground">Only admins can edit organization details</p>
                    )}
                    {isOrgAdmin && (
                      <Button className="bg-amber-500 hover:bg-amber-600 ml-auto" onClick={handleSaveOrganization} disabled={isSavingOrg}>
                        {isSavingOrg ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Check className="w-4 h-4 mr-2" />Save Organization</>}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">No organization found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Choose how you want to be notified. Changes are saved automatically.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {[
                  { key: 'email', label: 'Email Notifications', desc: 'Receive updates via email' },
                  { key: 'tasks', label: 'Task Assignments', desc: 'When a task is assigned to you' },
                  { key: 'documents', label: 'Document Processing', desc: 'When documents finish processing' },
                  { key: 'invoices', label: 'Invoice Updates', desc: 'When invoices are extracted' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={settings.notifications[item.key as keyof typeof settings.notifications]}
                      onCheckedChange={() => handleNotificationChange(item.key as keyof typeof settings.notifications)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Application Preferences</CardTitle>
              <CardDescription>Customize your application experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <select
                    id="theme"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={settings.preferences.theme}
                    onChange={(e) => setSettings({ ...settings, preferences: { ...settings.preferences, theme: e.target.value } })}
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <select
                    id="language"
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={settings.preferences.language}
                    onChange={(e) => setSettings({ ...settings, preferences: { ...settings.preferences, language: e.target.value } })}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button className="bg-amber-500 hover:bg-amber-600" onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Check className="w-4 h-4 mr-2" />Save Changes</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your password and security preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium">Change Password</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <div className="relative">
                      <Input 
                        id="current-password" 
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <div className="relative">
                      <Input 
                        id="new-password" 
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input 
                      id="confirm-password" 
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    />
                  </div>
                </div>
                <Button 
                  className="bg-amber-500 hover:bg-amber-600" 
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                >
                  {isChangingPassword ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Changing...</> : <><Lock className="w-4 h-4 mr-2" />Change Password</>}
                </Button>
              </div>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-medium">Two-Factor Authentication</h3>
                <p className="text-sm text-muted-foreground">2FA is not yet implemented. Coming soon!</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
