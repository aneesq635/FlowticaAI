import math

def calculate_distance(lat1, lon1, lat2, lon2):
    """Haversine formula to calculate distance in kilometers."""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    
    R = 6371.0  # Earth radius in KM
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat / 2)**2 + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * 
         math.sin(dlon / 2)**2)
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

# Islamabad Test Cases (approximate coordinates)
# E-7: 33.7297, 73.0373
# G-13: 33.6425, 72.9691
# F-6: 33.7297, 73.0549

print("--- Distance Test ---")
d1 = calculate_distance(33.7297, 73.0373, 33.6425, 72.9691)
print(f"E-7 to G-13: {d1:.2f} km")

d2 = calculate_distance(33.7297, 73.0373, 33.7297, 73.0549)
print(f"E-7 to F-6: {d2:.2f} km")

print("\n--- Radius Expansion Logic Test ---")
radii = [5, 10, 20, 30]
candidates = [
    {"name": "Near", "lat": 33.7298, "lon": 73.0374}, # ~0.02km
    {"name": "Mid", "lat": 33.6844, "lon": 73.0479},  # ~5.1km
    {"name": "Far", "lat": 33.6425, "lon": 72.9691}   # ~11.5km
]

user_lat, user_lon = 33.7297, 73.0373

for radius in radii:
    found = []
    for c in candidates:
        d = calculate_distance(user_lat, user_lon, c['lat'], c['lon'])
        if d <= radius:
            found.append(c['name'])
    print(f"Radius {radius}km: Found {len(found)} ({', '.join(found)})")
    if len(found) >= 2:
        print(f"Stopping at {radius}km because we found >= 2 candidates.")
        break
