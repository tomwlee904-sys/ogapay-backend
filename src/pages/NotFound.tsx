import Layout from '../components/Layout'

export default function NotFound() {
  return (
    <Layout sidebar={false}>
      <div style={{textAlign:'center',padding:'80px 20px'}}>
        <i className="ti ti-mood-confuzed" style={{fontSize:64,color:'var(--text3)',marginBottom:16,display:'block'}} />
        <h1 style={{fontFamily:'Outfit',fontSize:28}}>Page Not Found</h1>
        <p style={{color:'var(--text2)',fontSize:14,marginTop:8}}>This page doesn't exist yet.</p>
        <a className="cc-btn" href="/app" style={{marginTop:20,display:'inline-flex'}}>Go Home</a>
      </div>
    </Layout>
  )
}
