import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function GameMode() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/games', { replace: true });
  }, [navigate]);
  return null;
}
