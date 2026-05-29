import { describe, it, expect } from 'vitest';
import { GitEngine } from '$engine/index';
import { ShellRouter } from '$shell/router';

describe('full loop: touch → add → commit → echo >> → commit -am', () => {
  it('commit -am picks up an echo modification to a tracked file', () => {
    const eng = new GitEngine();
    const router = new ShellRouter(eng);
    router.execute('git init');
    router.execute('touch f.txt');
    router.execute('git add f.txt');
    router.execute('git commit -m "first"');
    const afterFirst = eng.log().length;
    router.execute('echo "more content" >> f.txt');
    const res = router.execute('git commit -am "update"');
    expect(res.exitCode).toBe(0);
    expect(eng.log().length).toBe(afterFirst + 1);
    expect(eng.log()[0].message).toBe('update');
  });
});
