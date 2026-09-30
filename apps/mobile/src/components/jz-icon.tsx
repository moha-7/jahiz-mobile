import type { ComponentType } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Banknote,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  EllipsisVertical,
  Home,
  Info,
  Languages,
  LogOut,
  Map,
  MapPin,
  Pencil,
  PlaneLanding,
  PlaneTakeoff,
  Plus,
  Receipt,
  Route,
  Search,
  Settings,
  Sparkles,
  Trash2,
  User,
  X,
  type LucideProps,
} from 'lucide-react-native';

export type JzIconName =
  | 'home'
  | 'plan'
  | 'payments'
  | 'profile'
  | 'notifications'
  | 'back'
  | 'next'
  | 'expand'
  | 'more'
  | 'search'
  | 'close'
  | 'swap'
  | 'origin'
  | 'destination'
  | 'edit'
  | 'delete'
  | 'language'
  | 'currency'
  | 'airport'
  | 'logout'
  | 'check'
  | 'warning'
  | 'calendar'
  | 'money'
  | 'receipt'
  | 'route'
  | 'sparkles'
  | 'settings'
  | 'add'
  | 'info';

export interface JzIconProps {
  name: JzIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  isRtl?: boolean;
}

type LucideIconComponent =
  ComponentType<LucideProps>;

const iconMap: Record<
  Exclude<JzIconName, 'back' | 'next'>,
  LucideIconComponent
> = {
  home: Home,
  plan: Map,
  payments: CreditCard,
  profile: User,
  notifications: Bell,
  expand: ChevronDown,
  more: EllipsisVertical,
  search: Search,
  close: X,
  swap: ArrowUpDown,
  origin: PlaneTakeoff,
  destination: PlaneLanding,
  edit: Pencil,
  delete: Trash2,
  language: Languages,
  currency: DollarSign,
  airport: MapPin,
  logout: LogOut,
  check: Check,
  warning: AlertCircle,
  calendar: Calendar,
  money: Banknote,
  receipt: Receipt,
  route: Route,
  sparkles: Sparkles,
  settings: Settings,
  add: Plus,
  info: Info,
};

function resolveDirectionalIcon(
  name: 'back' | 'next',
  isRtl: boolean,
): LucideIconComponent {
  if (name === 'back') {
    return isRtl
      ? ArrowRight
      : ArrowLeft;
  }

  return isRtl
    ? ChevronLeft
    : ChevronRight;
}

export function JzIcon({
  name,
  size = 22,
  color = '#0F172A',
  strokeWidth = 2,
  isRtl = false,
}: JzIconProps) {
  const Icon =
    name === 'back' || name === 'next'
      ? resolveDirectionalIcon(
          name,
          isRtl,
        )
      : iconMap[name];

  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={strokeWidth}
    />
  );
}
