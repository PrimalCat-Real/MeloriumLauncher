import { HashRouter, Route, Routes } from 'react-router-dom';
import { RecoilRoot } from 'recoil';

import Layout from './runtime/components/Layout';
import Login from './runtime/scenes/Login';
import ServerPanel from './runtime/scenes/ServerPanel';
import ServersList from './runtime/scenes/ServersList';
import ModList from './runtime/scenes/ModList';

export default function App() {
    return (
        <RecoilRoot>
            <HashRouter>
                <Routes>
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Login />} />
                        <Route path="/ServersList" element={<ServersList />} />
                        <Route path="/ServerPanel" element={<ServerPanel />} />
                        <Route path="/ModList" element={<ModList />} />
                    </Route>
                </Routes>
            </HashRouter>
        </RecoilRoot>
    );
}
