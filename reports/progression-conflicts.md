# Progression conflicts

Snapshot: 2026-10-20T021344065321 (regular). 503 tasks, 495 cached wiki responses.

Policy: add missing wiki edges; keep tarkov.dev statuses on overlapping edges (active/failed branches). A dev-only completion edge is excluded if it creates a cycle with the wiki chain. Other completion cycles fail the build for review. Trader loyalty is annotation only. Opaque globalVariable gates are reported, not guessed. Unresolved wiki prerequisites stay locked for review; self-links to requirement sections are not completion edges.

| Quest | Conflict | Detail |
|---|---|---|
| Sanitary Standards - Part 2 | tarkov.dev-only prerequisite | Sanitary Standards: complete |
| Chemical - Part 3 | status disagreement | Chemical - Part 2: tarkov.dev ['complete', 'active'], wiki ['complete']; using tarkov.dev |
| Friend From the West - Part 2 | tarkov.dev-only prerequisite | Friend From the West: complete |
| The Tarkov Shooter - Part 2 | status disagreement | The Tarkov Shooter - Part 1: tarkov.dev ['complete'], wiki ['active', 'complete']; using tarkov.dev |
| The Survivalist Path - Thrifty | wiki-only prerequisite | The Survivalist Path - Unprotected but Dangerous: complete |
| Cease Fire! | wiki-only prerequisite | The Delicious Sausage: complete |
| Thirsty - Hounds | wiki-only prerequisite | The Delicious Sausage: complete |
| Dragnet | wiki-only prerequisite | One Less Loose End: complete |
| Dragnet | wiki-only prerequisite | A Healthy Alternative: complete |
| Every Hunter Knows This | wiki-only prerequisite | Rough Tarkov: complete |
| Out of Curiosity | status disagreement | Chemical - Part 4: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| Big Customer | status disagreement | Chemical - Part 4: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| Loyalty Buyout | tarkov.dev-only prerequisite | Chemical - Part 4: failed |
| The Survivalist Path - Unprotected but Dangerous | tarkov.dev-only prerequisite | The Survivalist Path - Zhivchik: complete |
| The Survivalist Path - Wounded Beast | tarkov.dev-only prerequisite | The Survivalist Path - Unprotected but Dangerous: complete |
| The Survivalist Path - Wounded Beast | wiki-only prerequisite | The Survivalist Path - Zhivchik: complete |
| Decisions, Decisions [PVP ZONE] | wiki-only prerequisite | Against the Conscience - Part 2 [PVP ZONE]: complete |
| Decisions, Decisions [PVP ZONE] | tarkov.dev-only prerequisite | Between Two Fires [PVP ZONE]: active |
| Professional Fitness - Part 1 [PVP ZONE] | wiki-only prerequisite | Balancing - Part 1 [PVP ZONE]: complete |
| Professional Fitness - Part 1 [PVP ZONE] | tarkov.dev-only prerequisite | Arena Business [PVP ZONE]: active |
| Spa Tour - Part 6 | tarkov.dev-only prerequisite | Master Key: complete |
| Farming - Part 2 | tarkov.dev-only prerequisite | Playing the Market: complete |
| Insider | tarkov.dev-only prerequisite | Gunsmith - HK MP5: complete |
| Insider | tarkov.dev-only prerequisite | Ill-Wisher: complete |
| Dandies | wiki-only prerequisite | Ballet Lover: complete |
| Nothing Fishy About This | wiki-only prerequisite | Big Sale: complete |
| Spa Tour - Part 2 | tarkov.dev-only prerequisite | One-Way Ticket: complete |
| Dangerous Road | tarkov.dev-only prerequisite | Supply Plans: complete, failed |
| Signal - Part 3 | tarkov.dev-only prerequisite | Rat Hunting: complete |
| Signal - Part 4 | tarkov.dev-only prerequisite | Signal - Part 3: complete |
| Fishing Place | wiki-only prerequisite | Nostalgia: complete |
| Reserve | wiki-only prerequisite | The Delicious Sausage: complete |
| Glory to CPSU - Part 1 | tarkov.dev-only prerequisite | You've Got Mail: complete |
| The Huntsman Path - Controller | tarkov.dev-only prerequisite | The Survivalist Path - Tough Guy: complete |
| The Huntsman Path - Controller | wiki-only prerequisite | The Huntsman Path - Forest Cleaning: complete |
| The Survivalist Path - Cold Blooded | wiki-only prerequisite | The Survivalist Path - Wounded Beast: complete |
| The Survivalist Path - Cold Blooded | tarkov.dev-only prerequisite | The Huntsman Path - Controller: complete |
| The Survivalist Path - Eagle-Owl | wiki-only prerequisite | The Survivalist Path - Tough Guy: complete |
| The Survivalist Path - Eagle-Owl | tarkov.dev-only prerequisite | The Survivalist Path - Cold Blooded: complete |
| The Survivalist Path - Combat Medic | tarkov.dev-only prerequisite | The Survivalist Path - Eagle-Owl: complete |
| An Apple a Day Keeps the Doctor Away | tarkov.dev-only prerequisite | Health Care Privacy - Part 4: active, complete |
| Cargo X - Part 3 | tarkov.dev-only prerequisite | Tracker: complete |
| Shady Business | tarkov.dev-only prerequisite | What’s on the Flash Drive?: complete |
| Shady Business | tarkov.dev-only prerequisite | Acquaintance: complete |
| Hell on Earth - Part 2 | status disagreement | Hell on Earth - Part 1: tarkov.dev ['complete', 'active'], wiki ['complete']; using tarkov.dev |
| The Bunker - Part 2 | tarkov.dev-only prerequisite | The Bunker: complete |
| Easy Job - Part 2 | tarkov.dev-only prerequisite | Easy Job: complete |
| The Blood of War - Part 2 | tarkov.dev-only prerequisite | Fuel Crisis: complete |
| The Blood of War - Part 2 | tarkov.dev-only prerequisite | Sew it Good - Part 1: complete |
| Job for a Patriot | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Audiophile | wiki-only prerequisite | Minibus: complete |
| Audiophile | wiki-only prerequisite | Ballet Lover: complete |
| Drip-Out - Part 1 | wiki-only prerequisite | Minibus: active, complete |
| Drip-Out - Part 1 | wiki-only prerequisite | Minibus: active, complete |
| Gunsmith - AS VAL | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Athlete | tarkov.dev-only prerequisite | Health Care Privacy - Part 4: complete |
| The Guide | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Stray Dogs | wiki-only prerequisite | The Huntsman Path - Trophy: complete |
| Stray Dogs | wiki-only prerequisite | The Huntsman Path - Sellout: complete |
| Stray Dogs | wiki-only prerequisite | The Huntsman Path - Woods Keeper: complete |
| House Arrest - Part 2 | tarkov.dev-only prerequisite | House Arrest: complete |
| Slaughterhouse | wiki faction variants | The Huntsman Path - Administrator: either faction-specific task ID |
| Slaughterhouse | wiki-only prerequisite | The Huntsman Path - Administrator: complete |
| Slaughterhouse | wiki-only prerequisite | Broadcast - Part 4: complete |
| Slaughterhouse | wiki-only prerequisite | The Huntsman Path - Administrator: complete |
| The Tarkov Shooter - Part 6 | status disagreement | The Tarkov Shooter - Part 5: tarkov.dev ['active', 'complete'], wiki ['complete']; using tarkov.dev |
| The Survivalist Path - Junkie | tarkov.dev-only prerequisite | The Survivalist Path - Eagle-Owl: complete |
| Perfect Mediator | tarkov.dev-only prerequisite | Shaking Up the Teller: complete |
| Unique Experience | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Flint | tarkov.dev-only prerequisite | Chumming: complete |
| Surprise Gift [PVP ZONE] | wiki-only prerequisite | Against the Conscience - Part 2 [PVP ZONE]: complete |
| Surprise Gift [PVP ZONE] | tarkov.dev-only prerequisite | Between Two Fires [PVP ZONE]: active |
| Private Clinic | tarkov.dev-only prerequisite | Health Care Privacy - Part 4: complete |
| Gendarmerie - Mall Cop | tarkov.dev-only prerequisite | The Punisher - Part 6: complete |
| Gendarmerie - Tickets, Please | tarkov.dev-only prerequisite | Gendarmerie - Mall Cop: complete |
| Crisis | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Textile - Part 1 | wiki-only prerequisite | Sew it Good - Part 4: complete |
| Textile - Part 1 | wiki-only prerequisite | Sew it Good - Part 4: complete |
| Drip-Out - Part 2 | wiki-only prerequisite | Dandies: active, complete |
| Drip-Out - Part 2 | wiki-only prerequisite | Dandies: active, complete |
| Collector | wiki section requirement | Collector: self-link is a section pointer, not a prerequisite |
| Collector | tarkov.dev-only prerequisite | Postman Pat - Part 2: complete |
| Collector | tarkov.dev-only prerequisite | Chemical - Part 3: complete |
| Collector | tarkov.dev-only prerequisite | Sew it Good - Part 2: complete |
| Collector | tarkov.dev-only prerequisite | The Tarkov Shooter - Part 4: complete |
| Collector | tarkov.dev-only prerequisite | Shooter Born in Heaven: complete |
| Escort | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Consolation Prize | wiki-only prerequisite | Get a Foothold: complete |
| Consolation Prize | wiki-only prerequisite | Profit Retention: complete |
| The Huntsman Path - Relentless | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Background Check | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Shootout Picnic | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Delivery From the Past | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Bad Rep Evidence | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Postman Pat - Part 1 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Postman Pat - Part 2 | status disagreement | Postman Pat - Part 1: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| Shaking Up the Teller | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Shortage | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Sanitary Standards | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Blood in the Water | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Pharmacist | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Kind of Sabotage | tarkov.dev-only prerequisite | Supply Plans: active |
| General Wares | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Car Repair | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Extortionist | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Stirrup | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| What’s on the Flash Drive? | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Golden Swag | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Polikhim Hobo | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Chemical - Part 1 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Oil Run | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Ironclad Proof | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| I Need More Power | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Master Key | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Tigr Safari | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Scrap Metal | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Eagle Eye | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Humanitarian Supplies | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Weapons Circulation | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Cargo X | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Friend From the West | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - AKS-74U | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - HK MP5 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Playing the Market | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Farming | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Semiconductor Crisis | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Ill-Wisher | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Bad Habit | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Scout | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - Model 870 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - AKS-74N | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - AK-105 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Big Sale | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Dressed to Kill | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Inventory Files | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| A Big Loss | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Sew it Good - Part 1 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Sew it Good - Part 3 | tarkov.dev-only prerequisite | Sew it Good - Part 2: complete |
| Sew it Good - Part 4 | tarkov.dev-only prerequisite | Sew it Good - Part 3: complete |
| Sew it Good - Part 2 | tarkov.dev-only prerequisite | Sew it Good - Part 1: complete |
| The Key to Success | wiki-only prerequisite | Sew it Good - Part 2: complete |
| The Key to Success | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Charisma Brings Success | tarkov.dev-only prerequisite | Fuel Crisis: complete |
| Charisma Brings Success | tarkov.dev-only prerequisite | Sew it Good - Part 2: complete |
| No Fuss Needed | tarkov.dev-only prerequisite | The Key to Success: complete |
| Gratitude | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Pathfinder | wiki-only prerequisite | Gratitude: complete |
| Supervisor | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - MPX | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Living High is Not a Crime | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Hot Delivery | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Minibus | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Vitamins | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Supplements | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Informed Means Armed | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Metal Birds | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Tarkov Shooter - Part 1 | wiki-only prerequisite | Acquaintance: complete |
| The Tarkov Shooter - Part 1 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Insomnia | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Tarkov Import | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Shooter Born in Heaven | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| From Hand to Hand | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Peacekeeping Mission | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Small Things, Big Help | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Fertilizers | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Scavenger | wiki-only prerequisite | Hot Delivery: complete |
| Scavenger | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Setup | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Import | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Acquaintance | wiki-only prerequisite | Introduction: complete |
| The Huntsman Path - Secured Perimeter | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Trophy | wiki-only prerequisite | The Huntsman Path - Secured Perimeter: complete |
| The Huntsman Path - Trophy | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Forest Cleaning | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Woods Keeper | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Justice | wiki-only prerequisite | The Huntsman Path - Secured Perimeter: complete |
| The Huntsman Path - Justice | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Angry Watchman | wiki-only prerequisite | The Huntsman Path - Forest Cleaning: complete |
| The Huntsman Path - Angry Watchman | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Eraser | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Liberation | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| First Aid | wiki-only prerequisite | Acquaintance: complete |
| First Aid | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Courtesy Visit | wiki-only prerequisite | The Survivalist Path - Tough Guy: complete |
| Courtesy Visit | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Nostalgia | wiki-only prerequisite | Courtesy Visit: complete |
| Nostalgia | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Hunting Trip | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Anesthesia | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Sadist | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Tarkov-Style Diplomacy | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Rigged Game | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| A Difficult Choice | status disagreement | The Huntsman Path - Sadist: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| TerraGroup Employee | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Chemistry Closet | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Documents | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Disease History | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Safe Corridor | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Reserve Expert | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Pest Control | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Factory Chief | wiki-only prerequisite | Scout: complete |
| The Huntsman Path - Factory Chief | wiki-only prerequisite | The Huntsman Path - Forest Cleaning: complete |
| Intimidator | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Night Sweep | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Cleaner | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Trophies | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Special Equipment | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Courier | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Long Line | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Swift | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Outcasts | wiki-only prerequisite | The Huntsman Path - Forest Cleaning: complete |
| The Huntsman Path - Outcasts | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Seaside Vacation | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Overpopulation | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Energy Crisis | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Corporate Secrets | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Our Own Land | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Counteraction | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Long Road | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gifts from Tarkov | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Drug Trafficking | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Reconnaissance | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Top Secret | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Your Car Needs a Service | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Ballet Lover | wiki-only prerequisite | Audit: complete |
| Ballet Lover | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| House Arrest | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Urban Medicine | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Surveillance | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Revision - Streets of Tarkov | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Kings of the Rooftops | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Road Closed | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Information Source | unresolved wiki link | To the Light - Getting Acquainted (0 matching IDs); kept locked for review |
| Gunsmith - OP-SKS | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - P226R | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - Vector 9x19 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Debtor | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Power of Persuasion | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Delicious Sausage | wiki-only prerequisite | The Survivalist Path - Thrifty: complete |
| The Delicious Sausage | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Best Job in the World | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Big Game | wiki-only prerequisite | The Huntsman Path - Forest Cleaning: complete |
| The Huntsman Path - Big Game | wiki-only prerequisite | Urban Medicine: complete |
| The Door | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Paramedic | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Secret Recipe | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Pets Won't Need It | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Pyramid Scheme | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Luxurious Life | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Corporate Perks | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Secret to Productivity | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Pets Won't Need It - Part 2 | tarkov.dev-only prerequisite | Pets Won't Need It: complete |
| Properties All Around | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Steady Signal | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| No Swiping | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Immunity | tarkov.dev-only prerequisite | Friend Among Strangers: complete |
| One Less Loose End | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| A Healthy Alternative | tarkov.dev-only prerequisite | One Less Loose End: active |
| Claustrophobia | wiki-only prerequisite | The Huntsman Path - Forest Cleaning: complete |
| Claustrophobia | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Walls Have Eyes | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Easy-Breezy | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| New Paths | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Secrets of Polikhim | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Special Comms | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Forester's Duty | wiki-only prerequisite | Nostalgia: complete |
| Forester's Duty | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Rough Tarkov | wiki-only prerequisite | Acquaintance: complete |
| Shipping Delay - Part 2 | status disagreement | A Helping Hand: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| Shipping Delay - Part 1 | status disagreement | A Helping Hand: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| Hot Wheels - Let's Try Again | status disagreement | Hot Wheels: tarkov.dev ['failed'], wiki ['complete']; using tarkov.dev |
| Building Foundations | wiki-only prerequisite | Inevitable Response: complete |
| Building Foundations | status disagreement | Swift Retribution: tarkov.dev ['complete', 'failed'], wiki ['complete']; using tarkov.dev |
| Another Shipping Delay | wiki-only prerequisite | Hot Wheels: complete |
| Another Shipping Delay | tarkov.dev-only prerequisite | Inevitable Response: complete |
| Battery Change | wiki-only prerequisite | Stabilize Business: complete |
| Battery Change | wiki-only prerequisite | Stick in the Wheel: complete |
| Protect the Sky | status disagreement | Battery Change: tarkov.dev ['complete', 'failed'], wiki ['complete']; using tarkov.dev |
| The Price of Independence | tarkov.dev-only prerequisite | Battery Change: complete |
| The Price of Independence | tarkov.dev-only prerequisite | Battery Change: complete |
| The Higher They Fly | wiki-only prerequisite | Inevitable Response: complete |
| The Higher They Fly | tarkov.dev-only prerequisite | Building Foundations: active, complete |
| The Higher They Fly | wiki-only prerequisite | Swift Retribution: complete |
| Simple Side Job | status disagreement | Swift Retribution: tarkov.dev ['complete'], wiki ['active', 'complete']; using tarkov.dev |
| Abandoned Cargo | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Shipment Tracking | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Closer to the People | tarkov.dev-only prerequisite | Shipment Tracking: complete |
| Work Smarter | wiki-only prerequisite | Acquaintance: complete |
| Work Smarter | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Rite of Passage | tarkov.dev-only prerequisite | Work Smarter: complete |
| Belka and Strelka | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Private Club | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Connections Up North | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Shady Contractor | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Tarkov Butcher | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Sensory Analysis - Part 2 | status disagreement | Sensory Analysis - Part 1: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| Secret Message | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Hiking | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Special Order | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Fall Ailment | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Goals and Means | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Invasive Therapy | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Akimbo | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Stimulating Demand | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Sisyphus | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Survivalist Path - Unprotected but Dangerous | completion cycle: excluded dev-only edge | The Survivalist Path - Zhivchik: complete; cycle: The Survivalist Path - Thrifty -> The Survivalist Path - Unprotected but Dangerous -> The Survivalist Path - Zhivchik -> The Survivalist Path - Thrifty |
