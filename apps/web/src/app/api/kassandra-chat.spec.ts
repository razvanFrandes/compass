import { TestBed } from '@angular/core/testing';
import { API_BASE } from './api-config';
import { CONVERSATION_STORAGE_KEY, isConversationId, KassandraChat, SOCKET_FACTORY } from './kassandra-chat';
import { FakeSocket, live } from './testing';

function create(base = '/api'): KassandraChat {
  TestBed.configureTestingModule({
    providers: [
      { provide: SOCKET_FACTORY, useValue: (url: string) => new FakeSocket(url) },
      { provide: API_BASE, useValue: base },
    ],
  });
  return TestBed.inject(KassandraChat);
}

describe('KassandraChat', () => {
  beforeEach(() => {
    FakeSocket.reset();
    localStorage.clear();
  });

  afterEach(() => vi.restoreAllMocks());

  it('picks a conversation id, keeps it, and connects to its socket', () => {
    const chat = create();
    const id = chat.conversation();
    expect(isConversationId(id)).toBe(true);
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe(id);
    expect(FakeSocket.instances).toHaveLength(0);

    chat.connect();
    expect(FakeSocket.last.url).toBe(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/kassandra/ws?conversation=${id}`);
  });

  it('comes back to the stored conversation, and ignores a stored value that is not an id', () => {
    localStorage.setItem(CONVERSATION_STORAGE_KEY, 'kept-conversation_1');
    expect(create().conversation()).toBe('kept-conversation_1');

    TestBed.resetTestingModule();
    localStorage.setItem(CONVERSATION_STORAGE_KEY, 'not an id!');
    const fresh = create().conversation();
    expect(fresh).not.toBe('not an id!');
    expect(isConversationId(fresh)).toBe(true);
  });

  it('works when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const chat = create();
    expect(isConversationId(chat.conversation())).toBe(true);
    expect(isConversationId(chat.newConversation())).toBe(true);
  });

  it('asks in thinker mode by default, on an absolute base too', () => {
    const chat = create('https://juyo.razvanfrandes.com/api');
    const id = chat.ask('How is Lisbon doing?');
    expect(FakeSocket.last.url).toBe(`wss://juyo.razvanfrandes.com/api/kassandra/ws?conversation=${chat.conversation()}`);
    FakeSocket.last.serve({ type: 'snapshot', conversation: chat.conversation(), entries: [], live: live() });
    expect(FakeSocket.last.sent).toEqual([{ type: 'ask', text: 'How is Lisbon doing?', id, mode: 'thinker' }]);
    expect(chat.turns()[0]).toMatchObject({ question: 'How is Lisbon doing?', pending: true });
  });

  it('starts a new conversation with an empty transcript', () => {
    const chat = create();
    const before = chat.conversation();
    chat.connect();
    const socket = FakeSocket.last;
    socket.serve({ type: 'snapshot', conversation: before, entries: [{ id: 1, kind: 'user', text: 'old', at: 1 }], live: live() });

    const next = chat.newConversation();
    expect(next).not.toBe(before);
    expect(socket.closedByClient).toBe(true);
    expect(chat.entries()).toEqual([]);
    expect(chat.connected()).toBe(false);
    expect(localStorage.getItem(CONVERSATION_STORAGE_KEY)).toBe(next);

    chat.connect();
    expect(FakeSocket.last.url).toContain(`conversation=${next}`);
  });

  it('opens a conversation by id and refuses an invalid one', () => {
    const chat = create();
    expect(chat.open('bad id')).toBe(false);
    expect(FakeSocket.instances).toHaveLength(0);
    expect(chat.open('from-the-url')).toBe(true);
    expect(chat.conversation()).toBe('from-the-url');
    expect(FakeSocket.last.url).toContain('conversation=from-the-url');
  });

  it('closes the socket when the app is destroyed', () => {
    const chat = create();
    chat.connect();
    TestBed.resetTestingModule();
    expect(FakeSocket.last.closedByClient).toBe(true);
  });
});
