
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Users, Plus, LogIn } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useLudoMultiplayer } from '@/hooks/useLudoMultiplayer';

interface MultiplayerLudoSetupProps {
  onGameStart: (roomId: string, players: any[]) => void;
  onBack: () => void;
}

export function MultiplayerLudoSetup({ onGameStart, onBack }: MultiplayerLudoSetupProps) {
  const { language } = useTheme();
  const { currentRoom, players, isConnected, error, createRoom, joinRoom, leaveRoom } = useLudoMultiplayer();
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [gameMode, setGameMode] = useState('4human');

  const colors = [
    { id: 'blue', name: language === 'ar' ? 'أزرق' : 'Blue', class: 'bg-blue-500' },
    { id: 'red', name: language === 'ar' ? 'أحمر' : 'Red', class: 'bg-red-500' },
    { id: 'green', name: language === 'ar' ? 'أخضر' : 'Green', class: 'bg-green-500' },
    { id: 'yellow', name: language === 'ar' ? 'أصفر' : 'Yellow', class: 'bg-yellow-500' }
  ];

  const gameModes = [
    { id: '4human', name: language === 'ar' ? '4 لاعبين' : '4 Players' },
    { id: '2v2', name: language === 'ar' ? '2 ضد 2' : '2 vs 2' },
    { id: '1v1', name: language === 'ar' ? '1 ضد 1' : '1 vs 1' }
  ];

  const handleCreateRoom = async () => {
    const room = await createRoom(gameMode);
    if (room) {
      setMode('create');
    }
  };

  const handleJoinRoom = async () => {
    if (!roomCode || !playerName || !selectedColor) return;
    
    const player = await joinRoom(roomCode, playerName, selectedColor);
    if (player) {
      setMode('join');
    }
  };

  const copyRoomCode = () => {
    if (currentRoom?.room_code) {
      navigator.clipboard.writeText(currentRoom.room_code);
    }
  };

  const startGame = () => {
    if (currentRoom && players.length >= 2) {
      onGameStart(currentRoom.id, players);
    }
  };

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-4">{error}</div>
        <Button onClick={() => window.location.reload()}>
          {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
        </Button>
      </div>
    );
  }

  if (currentRoom) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">
            {language === 'ar' ? 'غرفة اللعب' : 'Game Room'}
          </h2>
          <div className="flex items-center justify-center space-x-2">
            <Badge variant="outline" className="text-lg px-4 py-2">
              {currentRoom.room_code}
            </Badge>
            <Button size="sm" variant="ghost" onClick={copyRoomCode}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>{language === 'ar' ? 'اللاعبون' : 'Players'} ({players.length}/4)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {players.map((player) => (
              <div key={player.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-4 h-4 rounded-full ${
                    player.player_color === 'blue' ? 'bg-blue-500' :
                    player.player_color === 'red' ? 'bg-red-500' :
                    player.player_color === 'green' ? 'bg-green-500' :
                    'bg-yellow-500'
                  }`} />
                  <span>{player.player_name}</span>
                </div>
                <Badge variant={player.is_ready ? 'default' : 'secondary'}>
                  {player.is_ready ? 
                    (language === 'ar' ? 'جاهز' : 'Ready') : 
                    (language === 'ar' ? 'في الانتظار' : 'Waiting')
                  }
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex space-x-2">
          <Button onClick={startGame} disabled={players.length < 2} className="flex-1">
            {language === 'ar' ? 'بدء اللعبة' : 'Start Game'}
          </Button>
          <Button variant="outline" onClick={leaveRoom}>
            {language === 'ar' ? 'مغادرة' : 'Leave'}
          </Button>
        </div>
      </div>
    );
  }

  if (!mode) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">
            {language === 'ar' ? 'اللعب متعدد الأشخاص' : 'Multiplayer'}
          </h2>
          <p className="text-gray-600 mb-6">
            {language === 'ar' ? 'العب اللودو مع أصدقائك عبر الإنترنت' : 'Play Ludo with friends online'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setMode('create')}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Plus className="w-5 h-5" />
                <span>{language === 'ar' ? 'إنشاء غرفة' : 'Create Room'}</span>
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? 'ابدأ لعبة جديدة وادع الأصدقاء' : 'Start a new game and invite friends'}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setMode('join')}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <LogIn className="w-5 h-5" />
                <span>{language === 'ar' ? 'انضمام لغرفة' : 'Join Room'}</span>
              </CardTitle>
              <CardDescription>
                {language === 'ar' ? 'انضم إلى لعبة موجودة باستخدام الكود' : 'Join an existing game with a code'}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Button variant="outline" onClick={onBack} className="w-full">
          {language === 'ar' ? 'رجوع' : 'Back'}
        </Button>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">
            {language === 'ar' ? 'إنشاء غرفة لعب' : 'Create Game Room'}
          </h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'نمط اللعبة' : 'Game Mode'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {gameModes.map((mode) => (
              <Button
                key={mode.id}
                variant={gameMode === mode.id ? 'default' : 'outline'}
                onClick={() => setGameMode(mode.id)}
                className="w-full"
              >
                {mode.name}
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="flex space-x-2">
          <Button onClick={handleCreateRoom} className="flex-1">
            {language === 'ar' ? 'إنشاء الغرفة' : 'Create Room'}
          </Button>
          <Button variant="outline" onClick={() => setMode(null)}>
            {language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
        </div>
      </div>
    );
  }

  if (mode === 'join') {
    const usedColors = players.map(p => p.player_color);
    const availableColors = colors.filter(c => !usedColors.includes(c.id));

    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">
            {language === 'ar' ? 'الانضمام لغرفة' : 'Join Room'}
          </h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ar' ? 'كود الغرفة' : 'Room Code'}
            </label>
            <Input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder={language === 'ar' ? 'ادخل كود الغرفة' : 'Enter room code'}
              className="text-center text-lg font-mono"
              maxLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ar' ? 'اسم اللاعب' : 'Player Name'}
            </label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={language === 'ar' ? 'ادخل اسمك' : 'Enter your name'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {language === 'ar' ? 'اختر اللون' : 'Choose Color'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableColors.map((color) => (
                <Button
                  key={color.id}
                  variant={selectedColor === color.id ? 'default' : 'outline'}
                  onClick={() => setSelectedColor(color.id)}
                  className="flex items-center space-x-2"
                >
                  <div className={`w-4 h-4 rounded-full ${color.class}`} />
                  <span>{color.name}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button 
            onClick={handleJoinRoom} 
            disabled={!roomCode || !playerName || !selectedColor}
            className="flex-1"
          >
            {language === 'ar' ? 'انضمام' : 'Join'}
          </Button>
          <Button variant="outline" onClick={() => setMode(null)}>
            {language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
