/**
 * A small list of real places used ONLY in demo mode (and tests), so the birthplace
 * search works before the GeoNames gazetteer is imported. Coordinates are standard
 * city-centre values. Includes deliberately ambiguous names (Hyderabad, Salem,
 * Aurangabad) to exercise the "confirm your place" step, and a high-latitude town
 * (Tromsø) to exercise the Placidus fallback.
 *
 * Live mode requires the full GeoNames import (npm run places:import).
 */
export interface DemoPlace {
  id: string;
  name: string;
  alternateNames: string[];
  admin1: string;
  countryCode: string;
  countryName: string;
  latitude: number;
  longitude: number;
  timezoneId: string;
  population: number;
}

const IN = { countryCode: "IN", countryName: "India", timezoneId: "Asia/Kolkata" };

export const DEMO_PLACES: DemoPlace[] = [
  { id: "demo:chennai", name: "Chennai", alternateNames: ["Madras", "சென்னை"], admin1: "Tamil Nadu", ...IN, latitude: 13.0827, longitude: 80.2707, population: 7088000 },
  { id: "demo:madurai", name: "Madurai", alternateNames: ["மதுரை"], admin1: "Tamil Nadu", ...IN, latitude: 9.9252, longitude: 78.1198, population: 1470755 },
  { id: "demo:coimbatore", name: "Coimbatore", alternateNames: ["Kovai", "கோயம்புத்தூர்"], admin1: "Tamil Nadu", ...IN, latitude: 11.0168, longitude: 76.9558, population: 1601438 },
  { id: "demo:tiruchirappalli", name: "Tiruchirappalli", alternateNames: ["Trichy", "Tiruchi", "திருச்சிராப்பள்ளி"], admin1: "Tamil Nadu", ...IN, latitude: 10.7905, longitude: 78.7047, population: 916857 },
  { id: "demo:salem-in", name: "Salem", alternateNames: ["சேலம்"], admin1: "Tamil Nadu", ...IN, latitude: 11.6643, longitude: 78.146, population: 829267 },
  { id: "demo:tirunelveli", name: "Tirunelveli", alternateNames: ["Nellai"], admin1: "Tamil Nadu", ...IN, latitude: 8.7139, longitude: 77.7567, population: 473637 },
  { id: "demo:thanjavur", name: "Thanjavur", alternateNames: ["Tanjore"], admin1: "Tamil Nadu", ...IN, latitude: 10.787, longitude: 79.1378, population: 222943 },
  { id: "demo:vellore", name: "Vellore", alternateNames: [], admin1: "Tamil Nadu", ...IN, latitude: 12.9165, longitude: 79.1325, population: 504079 },
  { id: "demo:puducherry", name: "Puducherry", alternateNames: ["Pondicherry"], admin1: "Puducherry", ...IN, latitude: 11.9416, longitude: 79.8083, population: 241773 },
  { id: "demo:bengaluru", name: "Bengaluru", alternateNames: ["Bangalore", "ಬೆಂಗಳೂರು"], admin1: "Karnataka", ...IN, latitude: 12.9716, longitude: 77.5946, population: 8443675 },
  { id: "demo:mysuru", name: "Mysuru", alternateNames: ["Mysore", "ಮೈಸೂರು"], admin1: "Karnataka", ...IN, latitude: 12.2958, longitude: 76.6394, population: 920550 },
  { id: "demo:mangaluru", name: "Mangaluru", alternateNames: ["Mangalore"], admin1: "Karnataka", ...IN, latitude: 12.9141, longitude: 74.856, population: 623841 },
  { id: "demo:hubballi", name: "Hubballi", alternateNames: ["Hubli"], admin1: "Karnataka", ...IN, latitude: 15.3647, longitude: 75.124, population: 943788 },
  { id: "demo:thiruvananthapuram", name: "Thiruvananthapuram", alternateNames: ["Trivandrum", "തിരുവനന്തപുരം"], admin1: "Kerala", ...IN, latitude: 8.5241, longitude: 76.9366, population: 957730 },
  { id: "demo:kochi", name: "Kochi", alternateNames: ["Cochin", "കൊച്ചി"], admin1: "Kerala", ...IN, latitude: 9.9312, longitude: 76.2673, population: 677381 },
  { id: "demo:kozhikode", name: "Kozhikode", alternateNames: ["Calicut"], admin1: "Kerala", ...IN, latitude: 11.2588, longitude: 75.7804, population: 609224 },
  { id: "demo:thrissur", name: "Thrissur", alternateNames: ["Trichur"], admin1: "Kerala", ...IN, latitude: 10.5276, longitude: 76.2144, population: 315957 },
  { id: "demo:hyderabad-in", name: "Hyderabad", alternateNames: ["హైదరాబాద్"], admin1: "Telangana", ...IN, latitude: 17.385, longitude: 78.4867, population: 6809970 },
  { id: "demo:warangal", name: "Warangal", alternateNames: [], admin1: "Telangana", ...IN, latitude: 17.9689, longitude: 79.5941, population: 704570 },
  { id: "demo:visakhapatnam", name: "Visakhapatnam", alternateNames: ["Vizag", "Vishakhapatnam"], admin1: "Andhra Pradesh", ...IN, latitude: 17.6868, longitude: 83.2185, population: 1728128 },
  { id: "demo:vijayawada", name: "Vijayawada", alternateNames: ["Bezawada"], admin1: "Andhra Pradesh", ...IN, latitude: 16.5062, longitude: 80.648, population: 1048240 },
  { id: "demo:tirupati", name: "Tirupati", alternateNames: [], admin1: "Andhra Pradesh", ...IN, latitude: 13.6288, longitude: 79.4192, population: 287035 },
  { id: "demo:mumbai", name: "Mumbai", alternateNames: ["Bombay"], admin1: "Maharashtra", ...IN, latitude: 19.076, longitude: 72.8777, population: 12442373 },
  { id: "demo:pune", name: "Pune", alternateNames: ["Poona"], admin1: "Maharashtra", ...IN, latitude: 18.5204, longitude: 73.8567, population: 3124458 },
  { id: "demo:nagpur", name: "Nagpur", alternateNames: [], admin1: "Maharashtra", ...IN, latitude: 21.1458, longitude: 79.0882, population: 2405665 },
  { id: "demo:aurangabad-mh", name: "Aurangabad", alternateNames: ["Chhatrapati Sambhajinagar"], admin1: "Maharashtra", ...IN, latitude: 19.8762, longitude: 75.3433, population: 1175116 },
  { id: "demo:aurangabad-br", name: "Aurangabad", alternateNames: [], admin1: "Bihar", ...IN, latitude: 24.7521, longitude: 84.3742, population: 102244 },
  { id: "demo:new-delhi", name: "New Delhi", alternateNames: ["Delhi", "नई दिल्ली"], admin1: "Delhi", ...IN, latitude: 28.6139, longitude: 77.209, population: 11007835 },
  { id: "demo:kolkata", name: "Kolkata", alternateNames: ["Calcutta"], admin1: "West Bengal", ...IN, latitude: 22.5726, longitude: 88.3639, population: 4496694 },
  { id: "demo:lucknow", name: "Lucknow", alternateNames: ["लखनऊ"], admin1: "Uttar Pradesh", ...IN, latitude: 26.8467, longitude: 80.9462, population: 2817105 },
  { id: "demo:varanasi", name: "Varanasi", alternateNames: ["Benares", "Kashi", "वाराणसी"], admin1: "Uttar Pradesh", ...IN, latitude: 25.3176, longitude: 82.9739, population: 1198491 },
  { id: "demo:jaipur", name: "Jaipur", alternateNames: ["जयपुर"], admin1: "Rajasthan", ...IN, latitude: 26.9124, longitude: 75.7873, population: 3046163 },
  { id: "demo:ahmedabad", name: "Ahmedabad", alternateNames: ["Amdavad"], admin1: "Gujarat", ...IN, latitude: 23.0225, longitude: 72.5714, population: 5570585 },
  { id: "demo:patna", name: "Patna", alternateNames: ["पटना"], admin1: "Bihar", ...IN, latitude: 25.5941, longitude: 85.1376, population: 1684222 },
  { id: "demo:bhopal", name: "Bhopal", alternateNames: [], admin1: "Madhya Pradesh", ...IN, latitude: 23.2599, longitude: 77.4126, population: 1798218 },
  { id: "demo:hyderabad-pk", name: "Hyderabad", alternateNames: [], admin1: "Sindh", countryCode: "PK", countryName: "Pakistan", timezoneId: "Asia/Karachi", latitude: 25.396, longitude: 68.3578, population: 1732693 },
  { id: "demo:salem-or", name: "Salem", alternateNames: [], admin1: "Oregon", countryCode: "US", countryName: "United States", timezoneId: "America/Los_Angeles", latitude: 44.9429, longitude: -123.0351, population: 175535 },
  { id: "demo:salem-ma", name: "Salem", alternateNames: [], admin1: "Massachusetts", countryCode: "US", countryName: "United States", timezoneId: "America/New_York", latitude: 42.5195, longitude: -70.8967, population: 44480 },
  { id: "demo:new-york", name: "New York", alternateNames: ["New York City", "NYC"], admin1: "New York", countryCode: "US", countryName: "United States", timezoneId: "America/New_York", latitude: 40.7128, longitude: -74.006, population: 8804190 },
  { id: "demo:london", name: "London", alternateNames: [], admin1: "England", countryCode: "GB", countryName: "United Kingdom", timezoneId: "Europe/London", latitude: 51.5074, longitude: -0.1278, population: 8961989 },
  { id: "demo:singapore", name: "Singapore", alternateNames: [], admin1: "Singapore", countryCode: "SG", countryName: "Singapore", timezoneId: "Asia/Singapore", latitude: 1.3521, longitude: 103.8198, population: 5453600 },
  { id: "demo:dubai", name: "Dubai", alternateNames: [], admin1: "Dubai", countryCode: "AE", countryName: "United Arab Emirates", timezoneId: "Asia/Dubai", latitude: 25.2048, longitude: 55.2708, population: 3331420 },
  { id: "demo:kuala-lumpur", name: "Kuala Lumpur", alternateNames: ["KL"], admin1: "Kuala Lumpur", countryCode: "MY", countryName: "Malaysia", timezoneId: "Asia/Kuala_Lumpur", latitude: 3.139, longitude: 101.6869, population: 1768000 },
  { id: "demo:colombo", name: "Colombo", alternateNames: ["கொழும்பு"], admin1: "Western Province", countryCode: "LK", countryName: "Sri Lanka", timezoneId: "Asia/Colombo", latitude: 6.9271, longitude: 79.8612, population: 648034 },
  { id: "demo:jaffna", name: "Jaffna", alternateNames: ["யாழ்ப்பாணம்"], admin1: "Northern Province", countryCode: "LK", countryName: "Sri Lanka", timezoneId: "Asia/Colombo", latitude: 9.6615, longitude: 80.0255, population: 88138 },
  { id: "demo:toronto", name: "Toronto", alternateNames: [], admin1: "Ontario", countryCode: "CA", countryName: "Canada", timezoneId: "America/Toronto", latitude: 43.6532, longitude: -79.3832, population: 2731571 },
  { id: "demo:sydney", name: "Sydney", alternateNames: [], admin1: "New South Wales", countryCode: "AU", countryName: "Australia", timezoneId: "Australia/Sydney", latitude: -33.8688, longitude: 151.2093, population: 5312163 },
  { id: "demo:kathmandu", name: "Kathmandu", alternateNames: [], admin1: "Bagmati", countryCode: "NP", countryName: "Nepal", timezoneId: "Asia/Kathmandu", latitude: 27.7172, longitude: 85.324, population: 1442271 },
  { id: "demo:tromso", name: "Tromsø", alternateNames: ["Tromso"], admin1: "Troms", countryCode: "NO", countryName: "Norway", timezoneId: "Europe/Oslo", latitude: 69.6492, longitude: 18.9553, population: 77544 },
];
