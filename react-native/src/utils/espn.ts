import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

export function getEspnGameUrl(sport: string, externalId: string): string {
  const sportUpper = sport.toUpperCase();
  let league = 'nba';
  let type = 'game';

  if (sportUpper === 'NBA' || sportUpper === 'BASKETBALL') league = 'nba';
  else if (sportUpper === 'NFL' || sportUpper === 'FOOTBALL') league = 'nfl';
  else if (sportUpper === 'MLB' || sportUpper === 'BASEBALL') league = 'mlb';
  else if (sportUpper === 'NHL' || sportUpper === 'HOCKEY') league = 'nhl';
  else if (sportUpper === 'EPL' || sportUpper === 'CHAMPIONS LEAGUE' || sportUpper === 'SOCCER') {
      league = 'soccer';
      type = 'match';
  }
  
  return `https://espn.com/${league}/${type}/_/gameId/${externalId}/`;
}

export async function openEspnGame(sport: string, externalId?: string) {
  if (!externalId) return;
  const url = getEspnGameUrl(sport, externalId);
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (error) {
    Linking.openURL(url);
  }
}

