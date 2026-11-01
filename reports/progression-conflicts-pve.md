# Progression conflicts

Snapshot: 2026-10-20 (pve). 499 tasks, 491 cached wiki responses.

Policy: add missing wiki edges; keep tarkov.dev statuses on overlapping edges (active/failed branches). A dev-only completion edge is excluded if it creates a cycle with the wiki chain. Other completion cycles fail the build for review. Trader loyalty levels are annotation only (the wiki fills a missing one); "LLn quests completed" gates count completed quests of that trader and level. Opaque globalVariable gates are reported, not guessed. Unresolved wiki prerequisites stay locked for review; self-links to requirement sections are not completion edges.

| Quest | Conflict | Detail |
|---|---|---|
| Sanitary Standards - Part 2 | tarkov.dev-only prerequisite | Sanitary Standards: complete |
| Friend From the West - Part 2 | tarkov.dev-only prerequisite | Friend From the West: complete |
| Every Hunter Knows This | wiki-only prerequisite | Rough Tarkov: complete |
| Out of Curiosity | status disagreement | Chemical - Part 4: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| Big Customer | status disagreement | Chemical - Part 4: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| Loyalty Buyout | tarkov.dev-only prerequisite | Chemical - Part 4: failed |
| Decisions, Decisions [PVE ZONE] | wiki-only prerequisite | Against the Conscience - Part 2 [PVE ZONE]: complete |
| Decisions, Decisions [PVE ZONE] | tarkov.dev-only prerequisite | Between Two Fires [PVE ZONE]: active |
| Professional Fitness - Part 1 [PVE ZONE] | wiki-only prerequisite | Balancing - Part 1 [PVE ZONE]: complete |
| Professional Fitness - Part 1 [PVE ZONE] | tarkov.dev-only prerequisite | Arena Business [PVE ZONE]: active |
| Against the Conscience - Part 1 [PVE ZONE] | tarkov.dev-only prerequisite | Arena Business [PVE ZONE]: complete |
| Against the Conscience - Part 1 [PVE ZONE] | wiki-only prerequisite | Hold the Lead [PVE ZONE]: complete |
| Spa Tour - Part 6 | tarkov.dev-only prerequisite | Master Key: complete |
| Farming - Part 2 | tarkov.dev-only prerequisite | Playing the Market: complete |
| Insider | tarkov.dev-only prerequisite | Gunsmith - HK MP5: complete |
| Insider | tarkov.dev-only prerequisite | Ill-Wisher: complete |
| Spa Tour - Part 2 | tarkov.dev-only prerequisite | One-Way Ticket: complete |
| Dangerous Road | tarkov.dev-only prerequisite | Supply Plans: complete, failed |
| Signal - Part 3 | tarkov.dev-only prerequisite | Rat Hunting: complete |
| Signal - Part 4 | tarkov.dev-only prerequisite | Signal - Part 3: complete |
| Glory to CPSU - Part 1 | tarkov.dev-only prerequisite | You've Got Mail: complete |
| The Hermit | tarkov.dev-only prerequisite | The Survivalist Path - Tough Guy: complete |
| The Survivalist Path - Combat Medic | tarkov.dev-only prerequisite | The Survivalist Path - Eagle-Owl: complete |
| An Apple a Day Keeps the Doctor Away | tarkov.dev-only prerequisite | Health Care Privacy - Part 4: active, complete |
| Cargo X - Part 3 | tarkov.dev-only prerequisite | Tracker: complete |
| Shady Business | tarkov.dev-only prerequisite | What’s on the Flash Drive?: complete |
| Shady Business | tarkov.dev-only prerequisite | Acquaintance: complete |
| The Bunker - Part 2 | tarkov.dev-only prerequisite | The Bunker: complete |
| Easy Job - Part 2 | tarkov.dev-only prerequisite | Easy Job: complete |
| The Blood of War - Part 2 | tarkov.dev-only prerequisite | Fuel Crisis: complete |
| The Blood of War - Part 2 | tarkov.dev-only prerequisite | Sew it Good - Part 1: complete |
| Job for a Patriot | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Job for a Patriot | wiki-only loyalty level | Prapor LL2 |
| Gunsmith - AS VAL | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - AS VAL | wiki-only loyalty level | Mechanic LL3 |
| Athlete | tarkov.dev-only prerequisite | Health Care Privacy - Part 4: complete |
| The Guide | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Guide | wiki-only loyalty level | Peacekeeper LL4 |
| House Arrest - Part 2 | tarkov.dev-only prerequisite | House Arrest: complete |
| The Tarkov Shooter - Part 6 | status disagreement | The Tarkov Shooter - Part 5: tarkov.dev ['active', 'complete'], wiki ['complete']; using tarkov.dev |
| Perfect Mediator | tarkov.dev-only prerequisite | Shaking Up the Teller: complete |
| Unique Experience | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Unique Experience | wiki-only loyalty level | Prapor LL4 |
| Flint | tarkov.dev-only prerequisite | Chumming: complete |
| Surprise Gift [PVE ZONE] | wiki-only prerequisite | Against the Conscience - Part 2 [PVE ZONE]: complete |
| Surprise Gift [PVE ZONE] | tarkov.dev-only prerequisite | Between Two Fires [PVE ZONE]: active |
| Private Clinic | tarkov.dev-only prerequisite | Health Care Privacy - Part 4: complete |
| Gendarmerie - Mall Cop | tarkov.dev-only prerequisite | The Punisher - Part 6: complete |
| Gendarmerie - Tickets, Please | tarkov.dev-only prerequisite | Gendarmerie - Mall Cop: complete |
| Crisis | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Crisis | wiki-only loyalty level | Therapist LL4 |
| Collector | wiki section requirement | Collector: self-link is a section pointer, not a prerequisite |
| Collector | tarkov.dev-only prerequisite | Postman Pat - Part 2: complete |
| Collector | tarkov.dev-only prerequisite | Chemical - Part 3: complete |
| Collector | tarkov.dev-only prerequisite | Sew it Good - Part 2: complete |
| Collector | tarkov.dev-only prerequisite | The Tarkov Shooter - Part 4: complete |
| Collector | tarkov.dev-only prerequisite | Shooter Born in Heaven: complete |
| Escort | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Escort | wiki-only loyalty level | Prapor LL4 |
| Consolation Prize | wiki-only prerequisite | Get a Foothold: complete |
| Consolation Prize | wiki-only prerequisite | Profit Retention: complete |
| The Huntsman Path - Relentless | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Relentless | wiki-only loyalty level | Jaeger LL4 |
| Background Check | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Shootout Picnic | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Delivery From the Past | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Delivery From the Past | wiki-only loyalty level | Prapor LL2 |
| Bad Rep Evidence | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Postman Pat - Part 1 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Postman Pat - Part 1 | wiki-only loyalty level | Prapor LL2 |
| Postman Pat - Part 2 | status disagreement | Postman Pat - Part 1: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| Shaking Up the Teller | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Shortage | wiki-only prerequisite | Operation Aquarius: complete |
| Shortage | wiki-only prerequisite | Supply Plans: complete |
| Shortage | wiki-only prerequisite | First in Line: complete |
| Shortage | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Sanitary Standards | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Sanitary Standards | wiki-only loyalty level | Therapist LL2 |
| Blood in the Water | wiki-only prerequisite | Operation Aquarius: complete |
| Blood in the Water | wiki-only prerequisite | Supply Plans: complete |
| Blood in the Water | wiki-only prerequisite | First in Line: complete |
| Blood in the Water | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Pharmacist | wiki-only prerequisite | Operation Aquarius: complete |
| Pharmacist | wiki-only prerequisite | Supply Plans: complete |
| Pharmacist | wiki-only prerequisite | First in Line: complete |
| Pharmacist | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Kind of Sabotage | tarkov.dev-only prerequisite | Supply Plans: active |
| General Wares | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| General Wares | wiki-only loyalty level | Therapist LL2 |
| Car Repair | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Car Repair | wiki-only loyalty level | Therapist LL3 |
| The Extortionist | wiki-only prerequisite | Supplier: complete |
| The Extortionist | wiki-only prerequisite | Burning Rubber: complete |
| The Extortionist | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Stirrup | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Stirrup | wiki-only loyalty level | Skier LL2 |
| What’s on the Flash Drive? | wiki-only prerequisite | Supplier: complete |
| What’s on the Flash Drive? | wiki-only prerequisite | Burning Rubber: complete |
| What’s on the Flash Drive? | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Golden Swag | wiki-only prerequisite | Supplier: complete |
| Golden Swag | wiki-only prerequisite | Burning Rubber: complete |
| Golden Swag | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Polikhim Hobo | wiki-only prerequisite | Supplier: complete |
| Polikhim Hobo | wiki-only prerequisite | Burning Rubber: complete |
| Polikhim Hobo | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Chemical - Part 1 | wiki-only prerequisite | Supplier: complete |
| Chemical - Part 1 | wiki-only prerequisite | Burning Rubber: complete |
| Chemical - Part 1 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Oil Run | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Ironclad Proof | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Ironclad Proof | wiki-only loyalty level | Prapor LL3 |
| I Need More Power | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| I Need More Power | wiki-only loyalty level | Peacekeeper LL2 |
| Master Key | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Tigr Safari | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Scrap Metal | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Scrap Metal | wiki-only loyalty level | Peacekeeper LL2 |
| Eagle Eye | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Eagle Eye | wiki-only loyalty level | Peacekeeper LL2 |
| Humanitarian Supplies | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Humanitarian Supplies | wiki-only loyalty level | Peacekeeper LL2 |
| Weapons Circulation | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Weapons Circulation | wiki-only loyalty level | Peacekeeper LL2 |
| Cargo X | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Cargo X | wiki-only loyalty level | Peacekeeper LL3 |
| Friend From the West | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Friend From the West | wiki-only loyalty level | Skier LL2 |
| Gunsmith - AKS-74U | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - HK MP5 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Playing the Market | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Playing the Market | wiki-only loyalty level | Mechanic LL2 |
| Farming | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Semiconductor Crisis | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Semiconductor Crisis | wiki-only loyalty level | Mechanic LL3 |
| Ill-Wisher | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Ill-Wisher | wiki-only loyalty level | Mechanic LL2 |
| Bad Habit | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Scout | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Scout | wiki-only loyalty level | Mechanic LL2 |
| Gunsmith - Model 870 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - Model 870 | wiki-only loyalty level | Mechanic LL2 |
| Gunsmith - AKS-74N | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - AKS-74N | wiki-only loyalty level | Mechanic LL3 |
| Gunsmith - AK-105 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - AK-105 | wiki-only loyalty level | Mechanic LL3 |
| Big Sale | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Big Sale | wiki-only loyalty level | Ragman LL2 |
| Dressed to Kill | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Inventory Files | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| A Big Loss | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Sew it Good - Part 1 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Key to Success | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Key to Success | wiki-only loyalty level | Ragman LL2 |
| Charisma Brings Success | tarkov.dev-only prerequisite | Fuel Crisis: complete |
| Charisma Brings Success | tarkov.dev-only prerequisite | Sew it Good - Part 2: complete |
| No Fuss Needed | tarkov.dev-only prerequisite | The Key to Success: complete |
| Gratitude | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Supervisor | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Supervisor | wiki-only loyalty level | Ragman LL2 |
| Gunsmith - MPX | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - MPX | wiki-only loyalty level | Mechanic LL3 |
| Living High is Not a Crime | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Living High is Not a Crime | wiki-only loyalty level | Ragman LL3 |
| Hot Delivery | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Hot Delivery | wiki-only loyalty level | Ragman LL2 |
| Minibus | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Minibus | wiki-only loyalty level | Ragman LL2 |
| Vitamins | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Vitamins | wiki-only loyalty level | Skier LL2 |
| Supplements | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Supplements | wiki-only loyalty level | Skier LL2 |
| Informed Means Armed | wiki-only prerequisite | Supplier: complete |
| Informed Means Armed | wiki-only prerequisite | Burning Rubber: complete |
| Informed Means Armed | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Metal Birds | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Tarkov Shooter - Part 1 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Insomnia | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Insomnia | wiki-only loyalty level | Peacekeeper LL4 |
| The Tarkov Import | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Tarkov Import | wiki-only loyalty level | Prapor LL3 |
| Shooter Born in Heaven | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Shooter Born in Heaven | wiki-only loyalty level | Mechanic LL4 |
| From Hand to Hand | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| From Hand to Hand | wiki-only loyalty level | Skier LL3 |
| Peacekeeping Mission | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Peacekeeping Mission | wiki-only loyalty level | Peacekeeper LL4 |
| Small Things, Big Help | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Fertilizers | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Fertilizers | wiki-only loyalty level | Mechanic LL3 |
| Scavenger | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Scavenger | wiki-only loyalty level | Ragman LL3 |
| Setup | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Setup | wiki-only loyalty level | Skier LL2 |
| Import | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Import | wiki-only loyalty level | Mechanic LL3 |
| The Huntsman Path - Secured Perimeter | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Secured Perimeter | wiki-only loyalty level | Jaeger LL3 |
| The Huntsman Path - Trophy | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Forest Cleaning | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Forest Cleaning | wiki-only loyalty level | Jaeger LL3 |
| The Huntsman Path - Sellout | wiki-only loyalty level | Jaeger LL2 |
| The Huntsman Path - Woods Keeper | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Justice | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Angry Watchman | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Eraser | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Eraser | wiki-only loyalty level | Jaeger LL3 |
| The Huntsman Path - Liberation | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Liberation | wiki-only loyalty level | Jaeger LL3 |
| First Aid | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Courtesy Visit | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Courtesy Visit | wiki-only loyalty level | Jaeger LL2 |
| Nostalgia | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Nostalgia | wiki-only loyalty level | Jaeger LL2 |
| Hunting Trip | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Hunting Trip | wiki-only loyalty level | Jaeger LL4 |
| Anesthesia | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Anesthesia | wiki-only loyalty level | Prapor LL2 |
| The Huntsman Path - Sadist | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Sadist | wiki-only loyalty level | Jaeger LL4 |
| Tarkov-Style Diplomacy | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Tarkov-Style Diplomacy | wiki-only loyalty level | Therapist LL3 |
| Rigged Game | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Rigged Game | wiki-only loyalty level | Skier LL3 |
| A Difficult Choice | status disagreement | The Huntsman Path - Sadist: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| TerraGroup Employee | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| TerraGroup Employee | wiki-only loyalty level | Peacekeeper LL4 |
| Chemistry Closet | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Chemistry Closet | wiki-only loyalty level | Mechanic LL2 |
| Documents | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Documents | wiki-only loyalty level | Prapor LL3 |
| Disease History | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Disease History | wiki-only loyalty level | Therapist LL3 |
| Safe Corridor | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Safe Corridor | wiki-only loyalty level | Skier LL3 |
| Reserve Expert | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Reserve Expert | wiki-only loyalty level | Ragman LL3 |
| Pest Control | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Pest Control | wiki-only loyalty level | Jaeger LL3 |
| The Huntsman Path - Factory Chief | wiki-only loyalty level | Jaeger LL2 |
| Capturing Outposts | wiki-only loyalty level | Prapor LL2 |
| Intimidator | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Intimidator | wiki-only loyalty level | Prapor LL4 |
| Night Sweep | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Night Sweep | wiki-only loyalty level | Skier LL4 |
| The Cleaner | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Cleaner | wiki-only loyalty level | Peacekeeper LL3 |
| Trophies | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Trophies | wiki-only loyalty level | Peacekeeper LL4 |
| Special Equipment | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Special Equipment | wiki-only loyalty level | Peacekeeper LL4 |
| The Courier | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Long Line | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Swift | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Outcasts | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Huntsman Path - Outcasts | wiki-only loyalty level | Jaeger LL3 |
| Seaside Vacation | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Seaside Vacation | wiki-only loyalty level | Therapist LL3 |
| Overpopulation | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Overpopulation | wiki-only loyalty level | Peacekeeper LL3 |
| Energy Crisis | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Energy Crisis | wiki-only loyalty level | Mechanic LL3 |
| Corporate Secrets | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Corporate Secrets | wiki-only loyalty level | Mechanic LL3 |
| Our Own Land | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Our Own Land | wiki-only loyalty level | Prapor LL3 |
| Counteraction | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Counteraction | wiki-only loyalty level | Peacekeeper LL4 |
| Long Road | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Long Road | wiki-only loyalty level | Skier LL3 |
| Gifts from Tarkov | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gifts from Tarkov | wiki-only loyalty level | Peacekeeper LL3 |
| Drug Trafficking | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Drug Trafficking | wiki-only loyalty level | Therapist LL3 |
| Reconnaissance | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Reconnaissance | wiki-only loyalty level | Prapor LL3 |
| Top Secret | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Top Secret | wiki-only loyalty level | Skier LL3 |
| Your Car Needs a Service | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Your Car Needs a Service | wiki-only loyalty level | Peacekeeper LL2 |
| You've Got Mail | wiki-only loyalty level | Prapor LL2 |
| Ballet Lover | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Ballet Lover | wiki-only loyalty level | Ragman LL2 |
| House Arrest | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| House Arrest | wiki-only loyalty level | Skier LL2 |
| Urban Medicine | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Urban Medicine | wiki-only loyalty level | Therapist LL2 |
| Surveillance | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Surveillance | wiki-only loyalty level | Mechanic LL2 |
| Revision - Streets of Tarkov | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Revision - Streets of Tarkov | wiki-only loyalty level | Peacekeeper LL2 |
| Green Corridor | wiki-only loyalty level | Prapor LL2 |
| Kings of the Rooftops | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Kings of the Rooftops | wiki-only loyalty level | Prapor LL2 |
| Road Closed | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Road Closed | wiki-only loyalty level | Peacekeeper LL2 |
| Information Source | unresolved wiki link | To the Light - Getting Acquainted (0 matching IDs); kept locked for review |
| Gunsmith - OP-SKS | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - OP-SKS | wiki-only loyalty level | Mechanic LL2 |
| Gunsmith - P226R | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - P226R | wiki-only loyalty level | Mechanic LL3 |
| Gunsmith - Vector 9x19 | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Gunsmith - Vector 9x19 | wiki-only loyalty level | Mechanic LL3 |
| Debtor | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Debtor | wiki-only loyalty level | Skier LL2 |
| Power of Persuasion | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Delicious Sausage | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Delicious Sausage | wiki-only loyalty level | Jaeger LL2 |
| Best Job in the World | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Best Job in the World | wiki-only loyalty level | Prapor LL4 |
| The Huntsman Path - Big Game | wiki-only loyalty level | Jaeger LL2 |
| District Patrol | wiki-only loyalty level | Prapor LL2 |
| The Door | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Door | wiki-only loyalty level | Mechanic LL3 |
| Paramedic | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Paramedic | wiki-only loyalty level | Therapist LL2 |
| The Secret Recipe | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Secret Recipe | wiki-only loyalty level | Skier LL2 |
| Pets Won't Need It | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Pets Won't Need It | wiki-only loyalty level | Therapist LL2 |
| Pyramid Scheme | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Pyramid Scheme | wiki-only loyalty level | Skier LL3 |
| Luxurious Life | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Corporate Perks | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Corporate Perks | wiki-only loyalty level | Mechanic LL2 |
| The Secret to Productivity | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Secret to Productivity | wiki-only loyalty level | Mechanic LL2 |
| Pets Won't Need It - Part 2 | tarkov.dev-only prerequisite | Pets Won't Need It: complete |
| Properties All Around | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Properties All Around | wiki-only loyalty level | Prapor LL2 |
| The Huntsman Path - Crooked Cop | wiki-only loyalty level | Jaeger LL2 |
| Steady Signal | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| No Swiping | wiki-only prerequisite | Supplier: complete |
| No Swiping | wiki-only prerequisite | Burning Rubber: complete |
| No Swiping | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Immunity | tarkov.dev-only prerequisite | Friend Among Strangers: complete |
| One Less Loose End | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| A Healthy Alternative | status disagreement | One Less Loose End: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| Claustrophobia | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Claustrophobia | wiki-only loyalty level | Jaeger LL2 |
| Possessor | wiki-only loyalty level | Prapor LL2 |
| The Walls Have Eyes | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| The Walls Have Eyes | wiki-only loyalty level | Skier LL2 |
| Easy-Breezy | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Easy-Breezy | wiki-only loyalty level | Prapor LL3 |
| New Paths | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Secrets of Polikhim | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Secrets of Polikhim | wiki-only loyalty level | Mechanic LL2 |
| Special Comms | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Special Comms | wiki-only loyalty level | Prapor LL3 |
| Forester's Duty | wiki-only prerequisite | Nostalgia: complete |
| Forester's Duty | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Forester's Duty | wiki-only loyalty level | Jaeger LL3 |
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
| A Helping Hand | wiki-only loyalty level | Mechanic LL2 |
| Abandoned Cargo | wiki-only prerequisite | Operation Aquarius: complete |
| Abandoned Cargo | wiki-only prerequisite | Supply Plans: complete |
| Abandoned Cargo | wiki-only prerequisite | First in Line: complete |
| Abandoned Cargo | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Shipment Tracking | wiki-only prerequisite | Operation Aquarius: complete |
| Shipment Tracking | wiki-only prerequisite | Supply Plans: complete |
| Shipment Tracking | wiki-only prerequisite | First in Line: complete |
| Shipment Tracking | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Closer to the People | tarkov.dev-only prerequisite | Shipment Tracking: complete |
| Provide Viewership | wiki-only prerequisite | Easy Money - Part 2 [PVE ZONE]: active, complete |
| Work Smarter | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Rite of Passage | tarkov.dev-only prerequisite | Work Smarter: complete |
| Belka and Strelka | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Private Club | wiki-only prerequisite | Supplier: complete |
| Private Club | wiki-only prerequisite | Burning Rubber: complete |
| Private Club | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Connections Up North | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Connections Up North | wiki-only loyalty level | Skier LL4 |
| Shady Contractor | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Shady Contractor | wiki-only loyalty level | Mechanic LL2 |
| The Tarkov Butcher | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Sensory Analysis - Part 2 | status disagreement | Sensory Analysis - Part 1: tarkov.dev ['active'], wiki ['active', 'complete']; using tarkov.dev |
| Special Order | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Special Order | wiki-only loyalty level | Prapor LL4 |
| Goals and Means | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Goals and Means | wiki-only loyalty level | Mechanic LL4 |
| Secret Message | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Secret Message | wiki-only loyalty level | Peacekeeper LL2 |
| Hiking | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Fall Ailment | wiki-only prerequisite | Operation Aquarius: complete |
| Fall Ailment | wiki-only prerequisite | Supply Plans: complete |
| Fall Ailment | wiki-only prerequisite | First in Line: complete |
| Fall Ailment | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Invasive Therapy | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Invasive Therapy | wiki-only loyalty level | Therapist LL3 |
| Akimbo | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Akimbo | wiki-only loyalty level | Ragman LL3 |
| Stimulating Demand | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Sisyphus | opaque globalVariable | 1 condition(s); no unlock meaning supplied, not used as a gate |
| Sisyphus | wiki-only loyalty level | Ragman LL3 |
