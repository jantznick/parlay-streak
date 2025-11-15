# Shared Code

This directory contains code shared between backend, frontend, and mobile apps.

## Structure

- `types/` - TypeScript types and interfaces
- `utils/` - Utility functions
- `constants/` - Shared constants

## Usage

### In Backend
```typescript
import { User } from '@shared/types';
import { calculateParlayValue } from '@shared/utils';
import { PARLAY_VALUES } from '@shared/constants';
```

### In Frontend
```typescript
import { User } from '@shared/types';
import { calculateInsuranceCost } from '@shared/utils';
```

### In Mobile
```typescript
import { Game } from '@shared/types';
import { INSURANCE_MULTIPLIERS } from '@shared/constants';
```

