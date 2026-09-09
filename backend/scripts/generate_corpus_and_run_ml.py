"""Generate a 200-message realistic multi-topic Telegram corpus and execute unified ML pipeline.

Ensures the dashboard is populated with 200 active records, diverse topics,
temporal trends, and prioritized narrative candidates.
"""

from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import random
import sys

# Ensure backend root is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure thread-safety on Windows / Python 3.14
os.environ["HF_DEACTIVATE_ASYNC_LOAD"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

from app.core.config import find_repo_root
from app.ml.pipeline.orchestrator import PipelineConfig, run_ml_pipeline
from app.schemas.canonical_message import AuthorType, CanonicalMessage, Platform
from app.storage.parquet import write_canonical_messages


CHANNELS = [
    {"author_id": "warmonitors", "username": "@warmonitors", "title": "War Monitor", "domain": "geopolitics"},
    {"author_id": "liveuamap", "username": "@liveuamap", "title": "Liveuamap", "domain": "conflict"},
    {"author_id": "OSINTdefender", "username": "@OSINTdefender", "title": "OSINTdefender", "domain": "conflict"},
    {"author_id": "GeoPWatch", "username": "@GeoPWatch", "title": "Geopolitical Watch", "domain": "geopolitics"},
    {"author_id": "BNONews", "username": "@BNONews", "title": "BNO News", "domain": "general_news"},
    {"author_id": "Ministry_Of_Defence_Gvt_India", "username": "@Ministry_Of_Defence_Gvt_India", "title": "Ministry of Defence, India", "domain": "india_defence"},
    {"author_id": "majormadhankumarmmk", "username": "@majormadhankumarmmk", "title": "Major Madhan Kumar", "domain": "india_defence"},
    {"author_id": "thehackernews", "username": "@thehackernews", "title": "The Hacker News", "domain": "cybersecurity"},
    {"author_id": "energy_monitor", "username": "@worldoilnews", "title": "World Oil & Energy Monitor", "domain": "energy"},
    {"author_id": "semiconductor_watch", "username": "@semiconductor_watch", "title": "Global Silicon & Chip Tracker", "domain": "technology"},
]

# Topic templates with variations to enable HDBSCAN semantic clustering
TOPIC_THEMES = [
    {
        "cluster_name": "border_security",
        "hashtags": ["#Security", "#BorderPatrol", "#Ladakh", "#DefenseUpdate"],
        "channel_indices": [5, 6, 0, 3],
        "templates": [
            "Security alert: Border Patrol deployed new high-altitude radar system at northern outpost in Ladakh sector. #Security #BorderPatrol",
            "Urgent: Army high-altitude surveillance radar operational in Ladakh northern frontier. Logistics resupply convoy en route. #Ladakh #DefenseUpdate",
            "Defense Ministry confirms upgraded electro-optical reconnaissance sensors active along eastern sector. #BorderPatrol #Security",
            "Forwarded dispatch: New perimeter detection grid deployed across LAC outpost sectors. Patrolling frequency intensified. #Security #Ladakh",
            "Defense infrastructure report: New road connectivity and radar posts completed along Ladakh frontline. #DefenseUpdate #BorderPatrol",
            "High-altitude border radar telemetry operational. Reconnaissance units report zero unauthorized crossings in Ladakh. #Security",
            "Border surveillance update: Sensor integration with satellite link completed across forward defense pickets. #BorderPatrol",
            "Breaking: Strategic all-weather radar deployment finalized along northern border heights. #Security #DefenseUpdate",
        ]
    },
    {
        "cluster_name": "crude_oil_energy",
        "hashtags": ["#OPEC", "#CrudeOil", "#EnergyMarkets", "#Inflation"],
        "channel_indices": [8, 4, 3, 0],
        "templates": [
            "Energy alert: OPEC+ delegates deliberate surprise voluntary crude oil production cut of 500k barrels/day. Brent spikes to $88/bbl. #OPEC #CrudeOil",
            "Brent crude futures surge 3.8% following unexpected supply restraint announcements from Gulf producers. #EnergyMarkets #CrudeOil",
            "Global energy desk: Refineries operating near full capacity as diesel crack spreads widen sharply amid supply tightness. #CrudeOil #OPEC",
            "Market update: Strategic petroleum reserves dip as crude oil shipments face maritime insurance price hikes. #EnergyMarkets #Inflation",
            "Inflation warning: Higher crude prices threaten central bank rate easing trajectory across European economies. #Inflation #CrudeOil",
            "Crude oil benchmark tests two-month highs following OPEC supply quota confirmation. Gasoline wholesale prices jump. #OPEC #EnergyMarkets",
            "Oil tankers rerouting around African cape; freight rates surge 25% amidst crude shipment premiums. #CrudeOil #EnergyMarkets",
            "Energy outlook: Global oil demand projections revised upward for Q3 by international energy research group. #CrudeOil #OPEC",
        ]
    },
    {
        "cluster_name": "cyber_infrastructure",
        "hashtags": ["#CyberSecurity", "#ZeroDay", "#CriticalInfrastructure", "#Infosec"],
        "channel_indices": [7, 4, 0, 3],
        "templates": [
            "Critical warning: Active zero-day exploitation targeting telecommunications core gateway equipment detected in the wild. #CyberSecurity #ZeroDay",
            "CERT alert: Urgent patch released for critical remote code execution vulnerability impacting industrial control switches. #ZeroDay #Infosec",
            "Cyber intelligence: State-backed advanced persistent threat group targeting energy grid supervisory SCADA networks. #CriticalInfrastructure #CyberSecurity",
            "Security researchers discover stealthy firmware backdoor in widely deployed enterprise VPN routers. Patch immediately. #Infosec #ZeroDay",
            "Ransomware gang claims disruption of municipal water filtration telemetry systems; incident response team dispatched. #CriticalInfrastructure #CyberSecurity",
            "Zero-day advisory: CISA adds critical gateway flaws to Known Exploited Vulnerabilities catalog. #ZeroDay #CyberSecurity",
            "Cyber defense bulletin: Coordinated credential stuffing campaign targets cloud infrastructure identity providers. #Infosec #CyberSecurity",
            "Financial institutions issue joint cybersecurity advisory regarding targeted spear-phishing campaigns against clearinghouses. #CyberSecurity",
        ]
    },
    {
        "cluster_name": "maritime_trade_red_sea",
        "hashtags": ["#RedSea", "#Shipping", "#MaritimeSecurity", "#GlobalTrade"],
        "channel_indices": [0, 1, 2, 3],
        "templates": [
            "Maritime alert: Commercial container vessel reports drone proximity incident near Bab-el-Mandeb strait in southern Red Sea. #RedSea #MaritimeSecurity",
            "Naval coalition warships intercept two anti-ship ballistic missiles launched toward international shipping corridor. #RedSea #Shipping",
            "Global logistics bulletin: Major ocean freight carriers reroute Asia-Europe container services via Cape of Good Hope. #Shipping #GlobalTrade",
            "Red Sea transit volume drops 45% month-on-month as maritime insurance risk premiums reach historic highs. #RedSea #GlobalTrade",
            "Naval escort operations established in Gulf of Aden for commercial bulk carriers transporting strategic minerals. #MaritimeSecurity #RedSea",
            "Container spot freight rates from Shanghai to Rotterdam double as voyage durations increase by 14 days around Africa. #Shipping #GlobalTrade",
            "Coast guard report: Commercial vessel safely transits southern corridor under naval helicopter patrol escort. #MaritimeSecurity #Shipping",
            "Supply chain notice: European automotive assembly plants schedule temporary pauses due to maritime parts delivery delays. #GlobalTrade #RedSea",
        ]
    },
    {
        "cluster_name": "semiconductor_chips",
        "hashtags": ["#Semiconductors", "#AIHardware", "#TechSupplyChain", "#Chips"],
        "channel_indices": [9, 7, 4, 3],
        "templates": [
            "Tech industry alert: Advanced extreme ultraviolet lithography equipment shipment restrictions expanded to additional international foundries. #Semiconductors #Chips",
            "Leading chip foundry accelerates 2nm semiconductor fabrication pilot line; full-volume production targeted for next year. #Chips #TechSupplyChain",
            "AI hardware report: High-bandwidth memory supply tightly constrained as data center accelerator demands exceed foundry forecasts. #AIHardware #Semiconductors",
            "Supply chain analysis: Silicon wafer manufacturing capacity expansions in Southeast Asia reach operational milestones. #TechSupplyChain #Chips",
            "Export control update: Revised licensing requirements announced for advanced GPU accelerator modules and wafer fabrication tools. #Semiconductors #AIHardware",
            "Semiconductor equipment orders rise 18% as global fab construction programs break ground in Europe and North America. #Chips #TechSupplyChain",
            "Next-generation chip packaging facilities achieve 95% yield rates, easing bottleneck for artificial intelligence compute clusters. #AIHardware #Semiconductors",
            "Automotive microcontroller inventory stabilizes after two years of silicon supply disruptions. #Semiconductors #TechSupplyChain",
        ]
    },
    {
        "cluster_name": "drone_technology_air_defense",
        "hashtags": ["#AirDefense", "#DroneWarfare", "#MilitaryTech", "#ElectronicWarfare"],
        "channel_indices": [0, 1, 2, 6],
        "templates": [
            "Air defense battery successfully intercepts swarm of six autonomous one-way attack drones over perimeter sector. #AirDefense #DroneWarfare",
            "Electronic warfare units demonstrate directional RF jamming capability, neutralizing hostile reconnaissance quadcopters. #ElectronicWarfare #DroneWarfare",
            "Military tech briefing: Counter-UAS directed energy laser system passes field endurance evaluations against composite drones. #MilitaryTech #AirDefense",
            "Surveillance radar acquires low-altitude drone track at 15km; mobile anti-aircraft artillery unit executes clean kinetic engagement. #AirDefense #MilitaryTech",
            "Tactical report: Fiber-optic guided FPV strike drones deployed along contested treelines, immune to conventional electronic jamming. #DroneWarfare #ElectronicWarfare",
            "New mobile air defense missile launcher vehicle undergoes rigorous cross-country trials in desert test range. #MilitaryTech #AirDefense",
            "Air defense command announces integrated airspace management radar grid connecting tactical SAMs with AWACS data feed. #AirDefense",
            "Defense procurement: MoD issues request for information for 500 indigenous man-portable counter-drone jamming rifles. #MilitaryTech #DroneWarfare",
        ]
    },
    {
        "cluster_name": "sports_and_culture",
        "hashtags": ["#Football", "#PremierLeague", "#SportsUpdate", "#ChampionsLeague"],
        "channel_indices": [4, 0],
        "templates": [
            "Match recap: Thrilling 3-2 victory in European cup tie as stoppage time header seals dramatic comeback. #Football #ChampionsLeague",
            "Transfer news: Star striker completes medical ahead of record club transfer deadline move. #PremierLeague #Football",
            "Tournament update: Qualification stages conclude with underdog squad securing historic tournament berth. #SportsUpdate #Football",
            "Manager press conference: Key midfielder ruled out for three weeks with hamstring strain sustained in derby match. #PremierLeague #SportsUpdate",
            "League standings: Title race tightens with three points separating top four contenders with six fixtures remaining. #Football #PremierLeague",
        ]
    },
]


def generate_corpus(target_count: int = 200) -> list[CanonicalMessage]:
    """Deterministically generate 200 canonical messages with realistic properties."""
    random.seed(42)
    messages: list[CanonicalMessage] = []
    base_time = datetime(2026, 9, 6, 8, 0, 0, tzinfo=timezone.utc)

    # Track message IDs for syndication / forwards
    origin_map: dict[str, str] = {}

    for i in range(target_count):
        # Pick theme
        theme = TOPIC_THEMES[i % len(TOPIC_THEMES)]
        template = random.choice(theme["templates"])
        channel_info = CHANNELS[random.choice(theme["channel_indices"])]

        # Time offsets across a 48-hour window with occasional bursts
        hour_offset = (i * 48.0 / target_count) + random.uniform(-0.5, 0.5)
        # Create some burst windows where 5-8 messages happen within 10 minutes
        if i % 15 in (1, 2, 3):
            hour_offset = (i // 15) * 3.5 + random.uniform(0.01, 0.08)

        msg_time = base_time + timedelta(hours=max(0.0, hour_offset))
        collected_time = msg_time + timedelta(minutes=random.uniform(1.0, 5.0))

        native_id = str(1000 + i)
        canonical_id = f"telegram:{channel_info['author_id']}:{native_id}"

        # Determine if forward/syndication
        is_fwd = False
        origin_id = None
        if i > 5 and random.random() < 0.25:
            # Pick a prior message in the same theme
            cluster_name = theme["cluster_name"]
            if cluster_name in origin_map and origin_map[cluster_name] != canonical_id:
                is_fwd = True
                origin_id = origin_map[cluster_name]
                template = f"Forwarded: {template}"
        else:
            origin_map[theme["cluster_name"]] = canonical_id

        # Engagement numbers
        views = random.randint(200, 25000)
        forwards = int(views * random.uniform(0.01, 0.08))
        replies = int(views * random.uniform(0.002, 0.015))

        # Reactions
        rxn_emojis = ["👍", "🔥", "❤️", "👏", "😱", "😡", "🤔"]
        reactions = {}
        for emoji in random.sample(rxn_emojis, k=random.randint(1, 4)):
            reactions[emoji] = random.randint(5, max(10, views // 50))

        # Media
        has_media = random.random() < 0.35
        media_types = ["photo"] if has_media else []

        msg = CanonicalMessage(
            canonical_id=canonical_id,
            platform=Platform.TELEGRAM,
            native_id=native_id,
            author_id=channel_info["author_id"],
            author_username=channel_info["username"],
            author_type=AuthorType.CHANNEL,
            channel_title=channel_info["title"],
            subscriber_count=random.randint(10000, 250000),
            published_at=msg_time,
            collected_at=collected_time,
            text_content=template,
            language="en",
            media_types=media_types,
            has_media=has_media,
            is_forward=is_fwd,
            origin_source_id=origin_id,
            views_count=views,
            forwards_count=forwards,
            replies_count=replies,
            reactions=reactions,
            hashtags=theme["hashtags"][:random.randint(1, 3)],
            mentions=[],
            urls=["https://t.me/news/update"] if random.random() < 0.2 else [],
        )
        messages.append(msg)

    # Sort deterministically by published_at
    messages.sort(key=lambda m: m.published_at)
    return messages


def main():
    repo_root = find_repo_root()
    target_count = 200
    print(f"Generating realistic corpus of {target_count} messages across {len(CHANNELS)} channels...")
    messages = generate_corpus(target_count=target_count)
    print(f"Successfully generated {len(messages)} CanonicalMessage records.")

    # Save Parquet
    parquet_path = repo_root / "data" / "processed" / "telegram" / "telegram_messages.parquet"
    parquet_path.parent.mkdir(parents=True, exist_ok=True)
    write_canonical_messages(messages, parquet_path, overwrite=True)
    print(f"Saved canonical Parquet dataset to: {parquet_path} ({parquet_path.stat().st_size:,} bytes)")

    # Execute ML pipeline
    print("\nExecuting Unified TRAJECT ML Pipeline on 200 records...")
    cfg = PipelineConfig(
        batch_size=32,
        sentiment_batch_size=32,
        embedding_batch_size=32,
        min_cluster_size=3,
        syndication_threshold=0.88,
        dataset_source="telegram_messages.parquet",
    )
    result = run_ml_pipeline(messages=messages, config=cfg)

    # Save analytics artifacts
    artifact_a = repo_root / "data" / "processed" / "telegram" / "telegram_messages-analytics-artifact.json"
    artifact_b = repo_root / "data" / "processed" / "telegram" / "telegram-analytics-artifact.json"

    result.save_analytics_artifact(artifact_a, overwrite=True)
    result.save_analytics_artifact(artifact_b, overwrite=True)

    m = result.metrics
    print("\n" + "=" * 80)
    print("CORPUS EXPANSION & ML EXECUTION SUMMARY")
    print("=" * 80)
    print(f"Total Messages:        {len(messages)}")
    print(f"Topic Clusters:        {result.topics.number_of_topics}")
    print(f"Clustered Messages:    {result.topics.clustered_messages} (Noise: {result.topics.noise_messages})")
    print(f"Narrative Candidates: {len(result.narrative_report.narrative_candidates)}")
    print(f"Total ML Runtime:      {m.total_runtime_seconds:.2f} s")
    print(f"Artifacts Saved To:")
    print(f"  - {artifact_a}")
    print(f"  - {artifact_b}")
    print("=" * 80)


if __name__ == "__main__":
    main()
