import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  listAdminUsers,
  createAdminUser as apiCreateAdminUser,
  assignRole as apiAssignRole,
  removeRole as apiRemoveRole,
  listSystemRoles as apiListSystemRoles,
  listSystemPermissions as apiListSystemPermissions,
  toggleUserStatus as apiToggleUserStatus,
  updateAdminUser as apiUpdateAdminUser,
  getAdminUser as apiGetAdminUser,
  type AdminUserSearchItem,
  type AdminUserSearchResponse
} from '@resomix/api-client';
import { message } from 'antd';

interface UseAdminUsersOptions {
  onError?: (title: string, message: string) => void;
  onSuccess?: (title: string, message: string) => void;
}

export function useAdminUsers(options?: UseAdminUsersOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [users, setUsers] = useState<AdminUserSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 30,
    total: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
  }, [debouncedQuery, roleFilter, statusFilter]);

  // Roles/Permissions Cache
  const [systemRoles, setSystemRoles] = useState<any[]>([]);
  const [systemPermissions, setSystemPermissions] = useState<any[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        page_size: pagination.pageSize,
        q: debouncedQuery || undefined,
        role: roleFilter,
        is_active: statusFilter,
      };

      const result = await listAdminUsers(params);
      
      if (result.success) {
        setUsers(result.data || []);
        // Note: listAdminUsers in api-client needs to return pagination metadata
        if ((result as any).pagination) {
          setPagination(prev => ({
            ...prev,
            total: (result as any).pagination.total,
          }));
        } else if (result.data) {
          // Fallback if backend doesn't provide total yet
          setPagination(prev => ({ ...prev, total: result.data!.length }));
        }
      } else {
        const errorMsg = result.error || 'Failed to fetch users';
        if (optionsRef.current?.onError) optionsRef.current.onError('Load Failed', errorMsg);
        else message.error(errorMsg);
      }
    } catch (_error) {
      const errorMsg = _error instanceof Error ? _error.message : 'An error occurred';
      if (optionsRef.current?.onError) optionsRef.current.onError('Error', errorMsg);
      else message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, debouncedQuery, roleFilter, statusFilter]);

  const fetchMetadata = useCallback(async () => {
    setMetaLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiListSystemRoles(),
        apiListSystemPermissions()
      ]);
      if (rolesRes.success) setSystemRoles(rolesRes.data || []);
      if (permsRes.success) setSystemPermissions(permsRes.data || []);
    } catch (err) {
      console.error("Failed to fetch roles/permissions", err);
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const createUser = async (data: any) => {
    try {
      const result = await apiCreateAdminUser(data);
      if (result.success) {
        if (optionsRef.current?.onSuccess) optionsRef.current.onSuccess('User Created', `Successfully created user ${data.username}`);
        else message.success('User created successfully');
        fetchUsers();
        return true;
      } else {
        const errorMsg = result.error || 'Failed to create user';
        if (optionsRef.current?.onError) optionsRef.current.onError('Creation Failed', errorMsg);
        else message.error(errorMsg);
        return false;
      }
    } catch {
      message.error('Error creating user');
      return false;
    }
  };

  const assignRole = async (userUuid: string, roleName: string) => {
    try {
      const result = await apiAssignRole(userUuid, roleName);
      if (result.success) {
        message.success(`Role ${roleName} assigned`);
        fetchUsers();
        return true;
      } else {
        message.error(result.error || 'Failed to assign role');
        return false;
      }
    } catch {
      message.error('Error assigning role');
      return false;
    }
  };

  const removeRole = async (userUuid: string, roleName: string) => {
    try {
      const result = await apiRemoveRole(userUuid, roleName);
      if (result.success) {
        message.success(`Role ${roleName} removed`);
        fetchUsers();
        return true;
      } else {
        message.error(result.error || 'Failed to remove role');
        return false;
      }
    } catch {
      message.error('Error removing role');
      return false;
    }
  };

  const toggleStatus = async (userUuid: string, username: string) => {
    try {
      const result = await apiToggleUserStatus(userUuid);
      if (result.success) {
        if (optionsRef.current?.onSuccess) optionsRef.current.onSuccess('Status Updated', `User ${username} status has been toggled.`);
        else message.success('User status updated');
        fetchUsers();
        return true;
      } else {
        const errorMsg = result.error || 'Failed to toggle user status';
        if (optionsRef.current?.onError) optionsRef.current.onError('Update Failed', errorMsg);
        else message.error(errorMsg);
        return false;
      }
    } catch {
      message.error('Error updating user status');
      return false;
    }
  };

  const updateUser = async (userUuid: string, data: Record<string, any>) => {
    try {
      const result = await apiUpdateAdminUser(userUuid, data);
      if (result.success) {
        if (optionsRef.current?.onSuccess) optionsRef.current.onSuccess('User Updated', 'User information has been updated.');
        else message.success('User updated successfully');
        fetchUsers();
        return true;
      } else {
        const errorMsg = result.error || 'Failed to update user';
        if (optionsRef.current?.onError) optionsRef.current.onError('Update Failed', errorMsg);
        else message.error(errorMsg);
        return false;
      }
    } catch {
      message.error('Error updating user');
      return false;
    }
  };

  const getUserDetail = async (userUuid: string) => {
    try {
      const result = await apiGetAdminUser(userUuid);
      return result;
    } catch {
      message.error('Error fetching user details');
      return null;
    }
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination(prev => ({ ...prev, current: page, pageSize }));
  };

  return {
    users,
    loading,
    pagination,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    systemRoles,
    systemPermissions,
    metaLoading,
    fetchUsers,
    createUser,
    assignRole,
    removeRole,
    toggleStatus,
    updateUser,
    getUserDetail,
    handlePageChange,
  };
}
