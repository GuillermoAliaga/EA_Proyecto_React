export const CATEGORIES = ['SPORT', 'LEISURE'] as const;
export const SUBCATEGORIES = ['BASKETBALL', 'RUNNING', 'ARCADE', 'TCG_BOARDGAMES'] as const;
export const MODALITIES = ['CASUAL', 'ORGANIZED'] as const;
export const ACTIVITY_STATUSES = ['OPEN', 'FULL', 'COMPLETED', 'CANCELLED'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Subcategory = (typeof SUBCATEGORIES)[number];
export type Modality = (typeof MODALITIES)[number];
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; 
}

export interface Activity {
  _id: string;
  title: string;
  description: string;
  category: Category;
  subcategory: Subcategory;
  modality: Modality;
  status: ActivityStatus;
  address: string;
  location: GeoPoint;
  startTime: string;      
  endTime: string;        
  minParticipants: number;
  maxParticipants: number;
  price: number;
  prize?: string;
  participants: string[];  // ids (o User[] si la API los popula)
  author?: string;         // id (o User si la API lo popula)
  deleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ActivityInput = Omit<
  Activity,
  '_id' | 'participants' | 'author' | 'deleted' | 'createdAt' | 'updatedAt'
>;