import { useState } from 'react';

export function useLoadingState(initialValue: boolean = true): [boolean, React.Dispatch<React.SetStateAction<boolean>>] {
  return useState(initialValue);
}
