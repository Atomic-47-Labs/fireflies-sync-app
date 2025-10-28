// GraphQL Queries for Fireflies API

export const GET_USER_QUERY = `
  query GetUser {
    user {
      user_id
      name
      email
      is_admin
      num_transcripts
    }
  }
`;

export const GET_TRANSCRIPTS_QUERY = `
  query GetTranscripts($limit: Int) {
    transcripts(limit: $limit) {
      id
      title
      date
      dateString
      duration
      organizer_email
      participants
      transcript_url
      audio_url
      fireflies_users
    }
  }
`;

export const GET_TRANSCRIPT_QUERY = `
  query GetTranscript($id: String!) {
    transcript(id: $id) {
      id
      title
      date
      dateString
      duration
      organizer_email
      participants
      transcript_url
      audio_url
      sentences {
        text
        speaker_name
        start_time
        end_time
      }
      summary {
        action_items
        overview
        outline
        shorthand_bullet
        keywords
      }
    }
  }
`;

