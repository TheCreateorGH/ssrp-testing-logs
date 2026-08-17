import { fetchApi, isAnyErrorResponse } from 'rozod';
import { postUsernamesUsers } from 'rozod/endpoints/usersv1';
import { getUsersUserid } from 'rozod/endpoints/usersv1';
import { getUsersAvatarHeadshot } from 'rozod/endpoints/thumbnailsv1';

async function getUserData(username) {
  // 1. Get User ID by Username
  const userRes = await fetchApi(postUsernamesUsers, {
    body: { usernames: [username], excludeBannedUsers: false }
  });

  console.log("\n\n")
  console.log(userRes)
  console.log("\n\n")
  
  if (isAnyErrorResponse(userRes) || !userRes.data?.length) {
    throw new Error('User not found');
  }
  const userId = userRes.data[0].id;

  // 2. Fetch Profile Info & Avatar concurrently
  const [profile, thumbnail] = await Promise.all([
    fetchApi(getUsersUserid, { userId }),
    fetchApi(getUsersAvatarHeadshot, { 
      userIds: [userId], 
      size: '352x352', 
      format: 'Png', 
      isCircular: true 
    })
  ]);

  if (!isAnyErrorResponse(profile) && !isAnyErrorResponse(thumbnail)) {
    console.log({
      id: profile.id,
      username: profile.name,
      displayName: profile.displayName,
      description: profile.description,
      pfpUrl: thumbnail.data?.[0]?.imageUrl
    });
  }
}

getUserData('TheCreateorYT');