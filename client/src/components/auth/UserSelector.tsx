import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import type { User } from 'shared';
import { cn } from '@/lib/utils';

interface UserSelectorProps {
  selectedId: number | null;
  onSelect: (user: User) => void;
}

export function UserSelector({ selectedId, onSelect }: UserSelectorProps) {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['auth', 'users'],
    queryFn: authApi.getUsers,
  });

  if (isLoading) {
    return <div className="text-center text-muted-foreground">Loading users...</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {users.map((user) => (
        <button
          key={user.id}
          onClick={() => onSelect(user)}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors hover:border-primary',
            selectedId === user.id ? 'border-primary bg-primary/5' : 'border-transparent bg-card'
          )}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
            {user.avatar || user.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium">{user.name}</span>
        </button>
      ))}
    </div>
  );
}
