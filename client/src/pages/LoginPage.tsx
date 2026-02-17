import { useState } from 'react';
import type { User } from 'shared';
import { useAuth } from '@/contexts/AuthContext';
import { UserSelector } from '@/components/auth/UserSelector';
import { PinInput } from '@/components/auth/PinInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export function LoginPage() {
  const { login } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePinComplete = async (pin: string) => {
    if (!selectedUser) return;
    setLoading(true);
    setError('');
    try {
      await login(selectedUser.id, pin);
    } catch {
      setError('Invalid PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">My Investments</CardTitle>
          <CardDescription>
            {selectedUser ? `Enter PIN for ${selectedUser.name}` : 'Who is using?'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedUser ? (
            <UserSelector selectedId={null} onSelect={setSelectedUser} />
          ) : (
            <div className="space-y-6">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(null); setError(''); }}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary">
                  {selectedUser.avatar || selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <h3 className="text-lg font-medium">{selectedUser.name}</h3>
              </div>
              <PinInput onComplete={handlePinComplete} disabled={loading} error={error} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
