import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  Check,
  Clock,
  Users,
} from 'lucide-react';
import { PageHeader } from '../../layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { TopicActivityChart } from '../../components/topics/TopicActivityChart';
import { LanguageDistribution } from '../../components/topics/LanguageDistribution';
import { PlatformDistribution } from '../../components/topics/PlatformDistribution';
import { CommunityTopics, AssociatedTopicItem } from '../../components/communities/CommunityTopics';
import { CommunityNarratives, AssociatedNarrativeItem } from '../../components/communities/CommunityNarratives';
import { CommunityRelationships } from '../../components/communities/CommunityRelationships';
import { communityService } from '../../services/communityService';
import { topicService } from '../../services/topicService';
import { narrativeService } from '../../services/narrativeService';
import { CommunityDetail } from '../../data/mock/communities';

export const CommunityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [associatedTopics, setAssociatedTopics] = useState<AssociatedTopicItem[]>([]);
  const [associatedNarratives, setAssociatedNarratives] = useState<AssociatedNarrativeItem[]>([]);
  const [relatedCommunities, setRelatedCommunities] = useState<CommunityDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWatching, setIsWatching] = useState(false);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      communityService.getCommunityById(id).then(async (res) => {
        setCommunity(res || null);
        if (res) {
          // Fetch associated topics
          const topics = await Promise.all(
            res.topTopicIds.map(async (tId) => {
              const top = await topicService.getTopicById(tId);
              return top
                ? { id: top.id, name: top.name, activityLevel: top.activityLevel }
                : { id: tId, name: tId };
            })
          );
          setAssociatedTopics(topics);

          // Fetch associated narratives
          const narratives = await Promise.all(
            res.associatedNarrativeIds.map(async (nId) => {
              const nar = await narrativeService.getNarrativeById(nId);
              return nar
                ? { id: nar.id, title: nar.title, currentFraming: nar.currentFraming, status: nar.status }
                : { id: nId, title: nId, currentFraming: '', status: 'Active' };
            })
          );
          setAssociatedNarratives(narratives);

          // Fetch related communities
          if (res.relatedCommunityIds.length > 0) {
            const relComms = await communityService.getRelatedCommunities(res.relatedCommunityIds);
            setRelatedCommunities(relComms);
          }
        }
        setIsLoading(false);
      });
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="py-16 text-center font-mono text-small text-text-muted">
        Loading community cluster profile...
      </div>
    );
  }

  if (!community) {
    return (
      <div className="space-y-6 font-sans">
        <PageHeader
          title="Community Not Found"
          description="The requested discussion cluster does not exist or has decayed."
          actions={
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/communities')}
            >
              Return to Communities
            </Button>
          }
        />
      </div>
    );
  }

  const activityBadgeVariant =
    community.activityLevel === 'High'
      ? 'signal'
      : community.activityLevel === 'Moderate'
      ? 'data'
      : 'neutral';

  return (
    <div className="space-y-8 font-sans">
      {/* 1. Header with Watch and Back Controls */}
      <PageHeader
        title={community.name}
        description={community.description}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              onClick={() => navigate('/communities')}
            >
              Communities
            </Button>

            <Button
              variant={isWatching ? 'primary' : 'secondary'}
              size="sm"
              leftIcon={isWatching ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              onClick={() => setIsWatching(!isWatching)}
            >
              {isWatching ? 'Watching' : 'Watch community'}
            </Button>
          </div>
        }
      />

      {/* Metadata Pill Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-[20px] border border-[rgba(228,233,245,0.85)] bg-white text-[13px] font-sans text-[#8591A5] shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[#111727] uppercase font-bold text-[12px] bg-[#EEF1F8] px-2.5 py-0.5 rounded-full">{community.id}</span>
          <span className="text-slate-300">•</span>
          <Badge variant={activityBadgeVariant} size="sm">
            {community.activityLevel} Activity
          </Badge>
          <span className="text-slate-300">•</span>
          <span className="font-medium text-[#111727]">{community.trend} Trend</span>
          <span className="text-slate-300">•</span>
          <span>{community.volume.toLocaleString()} tracked posts</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            {community.platforms.x > 0 && <Badge variant="neutral" size="sm">X ({community.platforms.x}%)</Badge>}
            {community.platforms.telegram > 0 && <Badge variant="data" size="sm">Telegram ({community.platforms.telegram}%)</Badge>}
          </div>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="text-[#64748B] hidden sm:inline text-[12px]">
            Active: {community.activePeriod}
          </span>
        </div>
      </div>

      {/* 2. Community Overview Metrics */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-5 rounded-[22px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8591A5]">
            Discussion Volume
          </div>
          <div className="font-sans text-[22px] font-bold text-[#111727] mt-1 tracking-tight">
            {community.volume.toLocaleString()}
            <span className="text-[12px] font-normal text-[#8591A5] ml-1.5">posts</span>
          </div>
        </div>

        <div className="p-5 rounded-[22px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8591A5]">
            Activity Level
          </div>
          <div className="font-sans text-[22px] font-bold text-[#2F65F6] mt-1 tracking-tight">
            {community.activityLevel}
          </div>
        </div>

        <div className="p-5 rounded-[22px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8591A5]">
            Active Operating Hours
          </div>
          <div className="font-sans text-[15px] text-[#111727] mt-2 flex items-center gap-1.5 font-bold">
            <Clock className="w-4 h-4 text-[#2F65F6]" />
            <span className="truncate">{community.activePeriod}</span>
          </div>
        </div>

        <div className="p-5 rounded-[22px] bg-white border border-[rgba(228,233,245,0.85)] shadow-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#8591A5]">
            Cluster Cohesion
          </div>
          <div className="font-sans text-[15px] text-[#2F65F6] mt-2 flex items-center gap-1.5 font-bold">
            <Users className="w-4 h-4 text-[#2F65F6]" />
            <span>High Density Network</span>
          </div>
        </div>
      </section>

      {/* 3. Activity Over Time Chart */}
      <section>
        <TopicActivityChart activitySeries={community.activitySeries} />
      </section>

      {/* 4. Top Topics & Associated Narratives */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CommunityTopics topics={associatedTopics} />
        <CommunityNarratives narratives={associatedNarratives} />
      </section>

      {/* 5. Language & Platform Profiles */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LanguageDistribution
          hindi={community.languages.hindi}
          hinglish={community.languages.hinglish}
          english={community.languages.english}
        />

        <PlatformDistribution
          x={community.platforms.x}
          telegram={community.platforms.telegram}
          migrationNote="Relative distribution indicates cross-posting behavior between public microblogging and private channels."
        />
      </section>

      {/* 6. Community Relationships */}
      {relatedCommunities.length > 0 && (
        <section>
          <CommunityRelationships relatedCommunities={relatedCommunities} />
        </section>
      )}
    </div>
  );
};
