import { Injectable } from '@nestjs/common';
import { CreatePodcastInput } from './dtos/create-podcast.dto';
import { CreateEpisodeDTO } from './dtos/create-episode.dto';
import { UpdateEpisodeDTO } from './dtos/update-episode.dto';
import { UpdatePodcastDTO } from './dtos/update-podcast.dto';
import { Episode } from './entities/episode.entity';
import { Podcast } from './entities/podcast.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { EpisodesOutput } from './dtos/get-episodes.dto';
import { GetPodcastsInput, PodcastOutput, PodcastsOutput } from "./dtos/get-podcast.dto";
import { CoreOutput } from 'src/common/dtos/core-output.dto';
import { User } from 'src/users/entities/user.entity';
import { CreateReviewInput, CreateReviewOutput } from './dtos/create-review.dto';
import { Review } from './entities/review.entity';
import { SearchPodcastsInput, SearchPodcastsOutput } from './dtos/search-podcasts.dto';
import { GetReviewsInput, GetReviewsOutput } from './dtos/get-reviews.dto';
import { UpdateReviewInput, UpdateReviewOutput } from './dtos/update-review.dto';
import { DeleteReviewInput, DeleteReviewOutput } from './dtos/delete-review.dto';
import { GetAllHashTagsInput, GetAllHashTagsOutput } from './dtos/get-hashtags.dto';
import { HashTag } from './entities/hash-tag.entity';
import { GetPodcastsByHashTagInput } from './dtos/get-podcasts-by-hashtag.dto';


@Injectable()
export class PodcastsService {

    constructor( 
        @InjectRepository(User) private readonly users: Repository<User>,
        @InjectRepository(Podcast) private readonly podcasts: Repository<Podcast>,
        @InjectRepository(Episode) private readonly episodes: Repository<Episode>,
        @InjectRepository(Review) private readonly reviews: Repository<Review>,
        @InjectRepository(HashTag) private readonly hashTags: Repository<HashTag>,
    ) {}

    private readonly PODCASTS_PER_PAGE = 10
    private readonly HASHTAGS_PER_PAGE = 10

    /* Find => Relation Option */
    async getAllPodcasts ( { page }: GetPodcastsInput ): Promise<PodcastsOutput> {
        try {
            const [podcasts, totalCounts] = await this.podcasts.findAndCount({ 
                relations: ['host'],
                take: this.PODCASTS_PER_PAGE,
                skip: (page - 1) * this.PODCASTS_PER_PAGE
            }); 
            const totalPages = Math.ceil( totalCounts / this.PODCASTS_PER_PAGE ) 
            if ( totalPages === 0 ) return { ok: true, podcasts: [] }
            if ( page > totalPages ) throw Error('Given page is bigger than total pages.')
            return { ok: true, podcasts, totalCounts, totalPages }
        }
        catch (error) {
            return {
                ok: false,
                error: error ? error.message : "Fail to get podcasts."
            }
        }
    }

    async searchPodcasts ( 
        { query, page }: SearchPodcastsInput 
    ): Promise<SearchPodcastsOutput> {
        try {
            const [ podcasts, totalCounts ] = await this.podcasts.findAndCount({
                relations: ['host'],
                where: {
                    title: ILike(`%${query}%`),
                },
                take: this.PODCASTS_PER_PAGE,
                skip: (page - 1) * this.PODCASTS_PER_PAGE
            })
            const totalPages = Math.ceil( totalCounts / this.PODCASTS_PER_PAGE ) 
            if ( totalPages === 0 ) return { ok: true, podcasts: [] }
            if ( page > totalPages ) throw Error('Given page is bigger than total pages.')
            return { ok: true, podcasts, totalCounts, totalPages }
        } catch (error) {
            return {
                ok: false,
                error: error ? error.message : "Fail to search podcasts."
            }
        }
    }

    async getMyPodcasts ( host: User, { page }: GetPodcastsInput ): Promise<PodcastsOutput> {
        try {
            const [podcasts, totalCounts] = await this.podcasts.findAndCount({ 
                loadRelationIds: { relations: ['host'] },
                where: { host: host.id },
                take: this.PODCASTS_PER_PAGE,
                skip: (page - 1) * this.PODCASTS_PER_PAGE
            }); 
            const totalPages = Math.ceil( totalCounts / this.PODCASTS_PER_PAGE ) 
            if ( totalPages === 0 ) return { ok: true, podcasts: [] }
            if ( page > totalPages ) throw Error('Given page is bigger than total pages.')
            return { ok: true, podcasts, totalCounts, totalPages }
        } catch (error) {
            return {
                ok: false,
                error: error ? error.message : "Fail to get podcasts."
            }
        }
    }

    /* 결과에 같은 팟캐스트가 담길 수 있는 가능성이 있음 */
    async getPodcastsByHashTag ({ page, hashTagStrings }: GetPodcastsByHashTagInput): Promise<PodcastsOutput> {
        try {
            const hashTagSlugs = hashTagStrings.map( hStr => hStr.trim().toLowerCase().replace(/ +/g, '-') )
            const foundHashTags = await this.hashTags.find({
                relations: ['podcasts'],
                where: [ ...hashTagSlugs.map( slug => ({ slug }) ) ]
            })
            
            const totalPodcasts = foundHashTags.map(hashTag => hashTag.podcasts).flat()
            const totalCounts = totalPodcasts.length
            if ( totalCounts === 0 ) return { ok: true, podcasts: [] }

            const totalPages = Math.ceil( totalCounts / this.PODCASTS_PER_PAGE ) 
            if ( page > totalPages ) throw Error('Given page is bigger than total pages.')
            
            const podcasts = totalPodcasts.slice( (page - 1) * this.PODCASTS_PER_PAGE, page * this.PODCASTS_PER_PAGE )
            return { ok: true, podcasts, totalCounts, totalPages }
        } catch (error) {
            return {
                ok: false,
                error: error ? error.message : "Fail to get podcasts."
            }
        }
    }
    
    async getAllHashTags ({ page }: GetAllHashTagsInput): Promise<GetAllHashTagsOutput> {
        try {
            const [hashTags, totalCounts] = await this.hashTags.findAndCount({ 
                take: this.HASHTAGS_PER_PAGE,
                skip: (page - 1) * this.HASHTAGS_PER_PAGE
            });
            const totalPages = Math.ceil( totalCounts / this.HASHTAGS_PER_PAGE ) 
            return { ok: true, hashTags, totalCounts, totalPages }
        } catch (error) {
            return {
                ok: false,
                error: error ? error.message : "Fail to get Hash Tags."
            }
        }
    }

    async getPodcast (pcID: number, relations?: (keyof Podcast)[]): Promise<PodcastOutput> {
        try {
            const foundPodcast = await this.podcasts.findOne(pcID, { relations });
            if (!foundPodcast) 
                return {
                    ok: false,
                    error: `Podcast id: ${pcID} doesn't exist.`
                }
            return { ok: true, podcast: foundPodcast }
        } catch (error) { 
            return { 
                ok: false, 
                error: error? error.message : "Fail to find podcast." 
            } 
        }
    }

    async getPodcastForHost (authUser: User, pcID: number): Promise<PodcastOutput> {
        try {
            const { ok, error, podcast } = await this.getPodcast(
                pcID, ['episodes', 'reviews', 'subscribers', 'host', 'hashTags']
            )
            if (!ok) throw Error(error)
            if (podcast.host.id !== authUser.id)
                throw Error('This Podcast is not yours !')
            
            return { ok: true, podcast }
        } catch (error) { 
            return { 
                ok: false, 
                error: error? error.message : "Fail to find podcast." 
            } 
        }
    }

    getPodcastForListener (pcID: number): Promise<PodcastOutput> {
        return this.getPodcast(pcID, ['host', 'episodes', 'reviews', 'hashTags'])
    }

    async createPodcast ( 
        host: User,
        { title, description, coverImg, hashTagNames }: CreatePodcastInput 
    ): Promise<CoreOutput> {
        try {
            let hashTags: HashTag[];
            
            if (hashTagNames.length === 0) { hashTags = [] }
            else {
                hashTags = await Promise.all(
                    hashTagNames.map( async hName => {
                        const hashTag = await this.hashTags.findOne({ where: {name: hName} })
                        if (hashTag) return hashTag

                        const name = hName.trim()
                        const slug = name.toLowerCase().replace(/ +/g, '-')
                        const newHashTag = this.hashTags.create({ name, slug })
                        return this.hashTags.save(newHashTag)                    
                    })
                ) 
            }

            const initalData = { 
                title, description, coverImg, hashTags, 
                rating: 0, episodes: [], reviews: [] 
            }
            const newPodcast = this.podcasts.create( initalData )
            newPodcast.host = host;
            await this.podcasts.save(newPodcast)
            return { ok: true }  
        } catch (error) {
            return {
                ok: false,
                error: 'Fail to create podcast'
            }
        }
    }

    async updatePodcast ({ id, data }: UpdatePodcastDTO ): Promise<CoreOutput> {
        try {
            const { ok, error } = await this.getPodcast(id)
            if ( !ok ) throw Error(error)
            await this.podcasts.update( id, { ...data } )
            return { ok: true }
        } catch (error) { 
            return { 
                ok: false, 
                error: error ? error.message : 'Fail to update podcast' 
            } 
        }
    }

    async deletePodcast (pcID: number): Promise<CoreOutput> { 
        try {
            const { ok, error } = await this.getPodcast(pcID)
            if ( !ok )  throw Error(error)
            await this.podcasts.delete(pcID)
            return { ok: true }
        } catch (error) { 
            return { 
                ok: false, 
                error: error ? error.message : 'Fail to delete podcast' 
            } 
        }
    }

    async toggleSubscribePodcast ( 
        subscriber: User,
        podcastId: number 
    ): Promise<CoreOutput> {
        try {
            subscriber = await this.users.findOne(subscriber.id, { relations: ['subscriptions'] })
            const { ok, error, podcast } = await this.getPodcast( podcastId );
            if (!ok) throw Error(error)
            
            if ( subscriber.subscriptions.some( sub => sub.id === podcastId ) ) 
                subscriber.subscriptions = subscriber.subscriptions.filter( sub => sub.id !== podcastId )
            else 
                subscriber.subscriptions = subscriber.subscriptions.concat([podcast])

            this.users.save(subscriber)
            return { ok: true }
        } catch (error) {
            return {
                ok: false,
                error: error ? error.message : "Fail to Create Podcast Review."
            }
        }
    }

        
    async getEpisodes (pcID: number): Promise<EpisodesOutput> {
        try {
            const { podcast, ok, error } = await this.getPodcast(pcID);
            if ( !ok ) throw Error(error)
            return { ok: true, episodes: podcast.episodes }
        } catch (error) { 
            return { 
                ok: false, 
                error: error ? error.message : 'Fail to get episodes' 
            }  
        }
    }
    
    async createEpisode ( {pcID, data}: CreateEpisodeDTO ): Promise<CoreOutput> {
        try {
            const { ok, error, podcast } = await this.getPodcast(pcID);
            if ( !ok ) throw Error(error)
    
            const newEpisode: Episode = this.episodes.create({
                ...data, rating: 0, podcast
            })
            await this.episodes.save(newEpisode);
            return { ok: true };
        } catch (error) {
            return { 
                ok: false, 
                error: error ? error.message : 'Fail to create episode' 
            }  
        }
    }

    async doesEpisodeExist (pcID: number, epID: number): Promise<CoreOutput> {
        try {
            const {ok, error, podcast} = await this.getPodcast(pcID);
            if ( !ok )  throw Error(error)
            const foundEpisode = podcast.episodes.find(ep => ep.id === epID)            
            if ( !foundEpisode ) throw Error(`Episode id: ${epID} does not exist.`)            
            return { ok: true }
        } catch (error) { 
            return { 
                ok: false, 
                error: error ? error.message : `Fail to find episode`  
            } 
        }
    }

    async updateEpisode ( { pcID, epID, data }: UpdateEpisodeDTO ): Promise<CoreOutput> {
        try {
            const { ok, error } = await this.doesEpisodeExist(pcID, epID);
            if ( !ok ) throw Error(error)
            await this.episodes.update(epID, {...data})
            return { ok: true }
        } catch (error) { 
            return { 
                ok: false, 
                error: error ? error.message : `Fail to update episode`  
            } 
        }
    }

    async deleteEpisode (pcID: number, epID: number): Promise<CoreOutput> {
        try {
            const { ok, error } = await this.doesEpisodeExist(pcID, epID)
            if ( !ok ) throw Error(error)
            await this.episodes.delete(epID)
            return { ok: true }
        } catch (error) {
            return { 
                ok: false, 
                error: error ? error.message : `Fail to delete episode`  
            } 
        }
    }

    async markEpisodeAsPlayed (listener: User, episodeId: number): Promise<CoreOutput> {
        try {
            const episode = await this.episodes.findOne( episodeId )
            if (!episode) throw Error("Couldn't find a episode")

            listener.playedEpisodes = listener.playedEpisodes.concat([ episode ])
            await this.users.save(listener)

            return { ok: true }
        } catch (error) {
            return {
                ok: false,
                error: error ? error.message : 'Fail to mark episode as played.'
            }
        }
    }

    async getReviews ({ pocastId }: GetReviewsInput): Promise<GetReviewsOutput> {
        try {
            const { ok, error, podcast } = await this.getPodcast(pocastId, ['reviews'])
            if (!ok) throw Error(error)

            return {
                ok: true,
                reviews: podcast.reviews
            }
        } catch (error) {
            return {
                ok: false,
                error: error ? error.message : 'Fail to get reviews'
            }
        }
    }

    async createReview (
        writer: User,
        { podcastId, description }: CreateReviewInput
    ): Promise<CreateReviewOutput> {
        try {
            const { ok, error, podcast } = await this.getPodcast( podcastId );
            if (!ok) throw Error(error)

            const newReivew = this.reviews.create({ description, writer, podcast })
            await this.reviews.save(newReivew)
            return { ok: true }
        } catch (error) {
            return {
                ok: false,
                error: error ? error.message : "Fail to Create Review."
            }
        }
    }

    async findReviewAndCheckUser ( loginUser: User, reviewId: number ): Promise<CoreOutput> {
        try {
            const review = await this.reviews.findOne( reviewId, { 
                loadRelationIds: { relations: ['writer'] } 
            } )
            if(!review) throw Error('Review does not exist.')
            if( loginUser.id !== review.writerId )
                throw Error('This Review is not yours.')

            return { ok: true }
        } catch (error) {
            return {
                ok: false,
                error: error ? error.message : "Fail to find Review."
            }
        }
    }

    async updateReview (
        loginUser: User, { id, description }: UpdateReviewInput
    ): Promise<UpdateReviewOutput> {
        try {
            const { ok, error } = await this.findReviewAndCheckUser(loginUser, id)
            if (!ok) throw Error(error)

            await this.reviews.update(id, { description })
            return { ok: true }
        } catch (error) {
            return {
                ok: false,
                error: error ? error.message : "Fail to Update Review."
            }
        }
    }

    async deleteReview ( 
        loginUser: User, { id }: DeleteReviewInput
    ): Promise<DeleteReviewOutput> {
        try {
            const { ok, error } = await this.findReviewAndCheckUser(loginUser, id)
            if (!ok) throw Error(error)

            await this.reviews.delete(id)
            return { ok: true }
        } catch (error) {
            return {
                ok: false,
                error: error ? error.message : "Fail to Delete Review."
            }
        }
    }
}
